/**
 * bpmWorker.ts — BPM Analysis Web Worker
 *
 * Receives mono Float32Array PCM from the main thread (decoded there
 * because AudioContext.decodeAudioData is a main-thread API).
 *
 * Pipeline mirrors the Android BpmAnalyzer:
 *  1. detectOnsetOffset   — skip ambient/speech intro (same thresholds)
 *  2. detectBpm           — onset-strength autocorrelation (55–215 BPM)
 *  3. detectFirstBeatMs   — find highest-energy attack in first 8 beats
 *
 * Message in:  { mono: ArrayBuffer, sampleRate: number, trackId: string }
 * Message out: { trackId, bpm, firstBeatMs, confidence }
 */

// ── Constants (mirrors Android BpmAnalyzer) ────────────────────────────────
const MIN_BPM                = 55
const MAX_BPM                = 215
const ONSET_WINDOW_SEC       = 0.05    // 50 ms RMS window
const ONSET_ENERGY_THRESHOLD = 0.20    // 20% of peak RMS
const ONSET_SUSTAIN_WINDOWS  = 5       // 5 × 50 ms = 250 ms hold
const ONSET_RISE_RATIO       = 1.20    // energy must be rising (vs 200 ms ago)
const CONFIDENCE_THRESHOLD   = 0.30
const MAX_ANALYSIS_SEC       = 90

// ── Utils ──────────────────────────────────────────────────────────────────

function maxOf(arr: Float32Array): number {
  let m = 0
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]
  return m
}

// ── 1. Onset / Intro Skip ──────────────────────────────────────────────────

function detectOnsetOffset(mono: Float32Array, sampleRate: number): number {
  const windowSamples = Math.floor(sampleRate * ONSET_WINDOW_SEC)
  const numWindows    = Math.floor(mono.length / windowSamples)

  if (numWindows < ONSET_SUSTAIN_WINDOWS + 6) return 0

  const rms = new Float32Array(numWindows)
  for (let w = 0; w < numWindows; w++) {
    const off = w * windowSamples
    let sq = 0
    for (let i = 0; i < windowSamples; i++) sq += mono[off + i] ** 2
    rms[w] = Math.sqrt(sq / windowSamples)
  }

  const peakRms  = maxOf(rms)
  if (peakRms === 0) return 0
  const threshold = peakRms * ONSET_ENERGY_THRESHOLD
  const lookback  = 4

  for (let w = 0; w < numWindows - ONSET_SUSTAIN_WINDOWS; w++) {
    let allAbove = true
    for (let j = 0; j < ONSET_SUSTAIN_WINDOWS; j++) {
      if (rms[w + j] < threshold) { allAbove = false; break }
    }
    if (!allAbove) continue

    const isRising = w < lookback || rms[w] >= rms[w - lookback] * ONSET_RISE_RATIO
    if (!isRising) continue

    return Math.max(0, w - 1) * windowSamples
  }

  return 0
}

// ── 2. BPM via Onset-Strength Autocorrelation ──────────────────────────────

function detectBpm(mono: Float32Array, sampleRate: number): { bpm: number; confidence: number } {
  const HOP    = 512
  const FRAME  = 2048
  const numFrames = Math.floor((mono.length - FRAME) / HOP)

  if (numFrames < 50) return { bpm: 120, confidence: 0 }

  // Energy envelope
  const energy = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    const off = f * HOP
    let sq = 0
    for (let i = 0; i < FRAME; i++) sq += mono[off + i] ** 2
    energy[f] = Math.sqrt(sq / FRAME)
  }

  // Onset strength = positive-rectified first difference of energy
  const strength = new Float32Array(numFrames)
  for (let f = 1; f < numFrames; f++) {
    strength[f] = Math.max(0, energy[f] - energy[f - 1])
  }

  const hopDur        = HOP / sampleRate
  const analyzeFrames = Math.min(strength.length, Math.floor(30 / hopDur))
  const minLag        = Math.max(2, Math.floor(60 / MAX_BPM / hopDur))
  const maxLag        = Math.min(analyzeFrames - 1, Math.ceil(60 / MIN_BPM / hopDur))

  // Normalized autocorrelation (handles loudness variation)
  let mean = 0
  for (let i = 0; i < analyzeFrames; i++) mean += strength[i]
  mean /= analyzeFrames

  let variance = 0
  for (let i = 0; i < analyzeFrames; i++) variance += (strength[i] - mean) ** 2
  variance /= analyzeFrames

  if (variance < 1e-10) return { bpm: 120, confidence: 0 }

  let bestLag  = minLag
  let bestCorr = -Infinity

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    const len = analyzeFrames - lag
    for (let i = 0; i < len; i++) {
      sum += (strength[i] - mean) * (strength[i + lag] - mean)
    }
    const corr = sum / (len * variance)
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag }
  }

  const bpm        = 60 / (bestLag * hopDur)
  const confidence = Math.max(0, (bestCorr + 1) / 2) // map [-1,1] → [0,1]

  return {
    bpm: Math.max(MIN_BPM, Math.min(MAX_BPM, bpm)),
    confidence,
  }
}

// ── 3. First Beat — highest-energy attack in first 8 beats ─────────────────

function detectFirstBeatMs(mono: Float32Array, sampleRate: number, bpm: number): number {
  if (bpm <= 0) return 0

  const beatSamples   = Math.floor(60 / bpm * sampleRate)
  const searchSamples = Math.min(mono.length, beatSamples * 8)
  const winSamples    = Math.floor(0.020 * sampleRate)   // 20 ms window
  const stepSamples   = Math.floor(0.005 * sampleRate)   // 5 ms step

  let bestRms = -1
  let bestOff = 0

  for (let off = 0; off + winSamples < searchSamples; off += stepSamples) {
    let sq = 0
    for (let i = 0; i < winSamples; i++) sq += mono[off + i] ** 2
    const rms = Math.sqrt(sq / winSamples)
    if (rms > bestRms) { bestRms = rms; bestOff = off }
  }

  return (bestOff / sampleRate) * 1000
}

// ── Entry Point ────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const { mono: buf, sampleRate, trackId } = e.data as {
    mono: ArrayBuffer
    sampleRate: number
    trackId: string
  }

  try {
    const fullMono   = new Float32Array(buf)
    const maxSamples = Math.floor(MAX_ANALYSIS_SEC * sampleRate)
    const mono       = fullMono.length > maxSamples ? fullMono.subarray(0, maxSamples) : fullMono

    // 1. Skip ambient intro
    const skipSamples  = detectOnsetOffset(mono, sampleRate)
    const analysisMono = skipSamples > 0 ? mono.subarray(skipSamples) : mono

    // 2. BPM
    const { bpm, confidence } = detectBpm(analysisMono, sampleRate)

    // 3. First beat (relative to onset-trimmed audio)
    const relMs = confidence >= CONFIDENCE_THRESHOLD
      ? detectFirstBeatMs(analysisMono, sampleRate, bpm)
      : 0

    // 4. Re-add onset skip offset to get full-track ms
    const onsetOffsetMs = (skipSamples / sampleRate) * 1000
    const firstBeatMs   = confidence >= CONFIDENCE_THRESHOLD
      ? Math.round(relMs + onsetOffsetMs)
      : 0

    self.postMessage({
      trackId,
      bpm:         Math.round(bpm * 10) / 10,
      firstBeatMs,
      confidence:  Math.round(confidence * 1000) / 1000,
    })
  } catch (err) {
    self.postMessage({ trackId, bpm: 0, firstBeatMs: 0, confidence: 0, error: String(err) })
  }
}

export {}