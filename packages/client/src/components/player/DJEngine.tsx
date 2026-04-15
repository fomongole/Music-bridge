/**
 * DJEngine.tsx
 *
 * React integration layer for AutoMixEngine.
 * Renders nothing — pure side-effect component.
 * Only mounts when Auto Mix is enabled (isEnabled = true).
 *
 * Responsibilities:
 *  • Owns the AutoMixEngine and BPM Worker lifecycle (init on mount, dispose on unmount)
 *  • Decodes audio on the main thread → transfers Float32Array to the BPM worker
 *  • Routes engine.onRequestNextTrack → reads queue → calls engine.crossfadeTo()
 *  • Routes engine.onRequestPrebuffer → pre-loads secondary player
 *  • Syncs engine state → usePlayerStore + useAutoMixStore
 *  • Syncs user actions (play/pause, seek, volume) → engine via subscribeWithSelector
 *  • Manages per-track BPM cache in localStorage
 *
 * NOTE: usePlayerStore must be wrapped with the subscribeWithSelector middleware
 * for the selector-based .subscribe() calls in this file to work correctly.
 */

import { useEffect, useRef, useCallback } from 'react'
import { AutoMixEngine }   from '../../engine/AutoMixEngine'
import { useAutoMixStore } from '../../store/useAutoMixStore'
import { usePlayerStore }  from '../../store/usePlayerStore'
import { SERVER_URL }      from '../../config'
import type { BpmInfo }    from '../../engine/AutoMixEngine'

// Vite worker import
// @ts-ignore — Vite ?worker syntax
import BpmWorker from '../../workers/bpmWorker?worker'

// ── BPM localStorage cache ─────────────────────────────────────────────────

const BPM_CACHE_KEY = 'music-bridge-bpm-cache-v1'

function readBpmCache(): Record<string, BpmInfo> {
  try { return JSON.parse(localStorage.getItem(BPM_CACHE_KEY) ?? '{}') }
  catch { return {} }
}

function writeBpmCache(cache: Record<string, BpmInfo>): void {
  try { localStorage.setItem(BPM_CACHE_KEY, JSON.stringify(cache)) }
  catch { /* quota exceeded — ignore */ }
}

// ══════════════════════════════════════════════════════════════════════════
// DJEngineCore — only mounts when Auto Mix is enabled
// ══════════════════════════════════════════════════════════════════════════

function DJEngineCore() {
  const engineRef       = useRef<AutoMixEngine | null>(null)
  const workerRef       = useRef<Worker | null>(null)
  const bpmCache        = useRef<Record<string, BpmInfo>>(readBpmCache())
  const decodeCtxRef    = useRef<AudioContext | null>(null)

  // Track which currentTrack change was driven by the engine (crossfade)
  // vs by the user. Prevents double-loading the same track.
  const engineDrivenId = useRef<string | null>(null)

  // Mirrors engine.isPlaying so we can distinguish user vs engine play/pause events
  const lastEnginePlayingRef = useRef(false)

  const {
    crossfadeDurationMs, cuePointOffsetMs, useHalfwayMix,
    syncEngineState, setBpmAnalysisResult, setAnalyzingBpm,
  } = useAutoMixStore()

  // ── BPM analysis ─────────────────────────────────────────────────────────

  const analyzeBpm = useCallback(async (trackUrl: string, trackId: string) => {
    // Return immediately from cache if available
    if (bpmCache.current[trackId]) {
      const info = bpmCache.current[trackId]
      engineRef.current?.updateCurrentBpmInfo(info.bpm, info.firstBeatMs)
      setBpmAnalysisResult(info.bpm, info.confidence)
      return
    }

    setAnalyzingBpm(true)

    try {
      const resp   = await fetch(trackUrl)
      const buffer = await resp.arrayBuffer()

      // AudioContext.decodeAudioData is main-thread only
      if (!decodeCtxRef.current || decodeCtxRef.current.state === 'closed') {
        decodeCtxRef.current = new AudioContext()
      }
      const audioBuf = await decodeCtxRef.current.decodeAudioData(buffer.slice(0))

      const sampleRate = audioBuf.sampleRate
      const maxSamples = Math.min(audioBuf.length, Math.floor(90 * sampleRate))
      const mono       = new Float32Array(maxSamples)
      const nCh        = audioBuf.numberOfChannels

      for (let c = 0; c < nCh; c++) {
        const ch = audioBuf.getChannelData(c)
        for (let i = 0; i < maxSamples; i++) mono[i] += ch[i]
      }
      if (nCh > 1) {
        for (let i = 0; i < maxSamples; i++) mono[i] /= nCh
      }

      // Zero-copy transfer to worker (mono.buffer is detached after this)
      workerRef.current?.postMessage(
        { mono: mono.buffer, sampleRate, trackId },
        [mono.buffer]
      )
    } catch (err) {
      console.warn('[DJEngine] BPM analysis failed for', trackId, err)
      setAnalyzingBpm(false)
    }
  }, [setBpmAnalysisResult, setAnalyzingBpm])

  // ── Mount: initialise engine + BPM worker ─────────────────────────────────

  useEffect(() => {
    // ── Engine ───────────────────────────────────────────────────────────
    const engine = new AutoMixEngine()
    engine.initialize()
    engineRef.current = engine

    // ── Worker ───────────────────────────────────────────────────────────
    const worker: Worker = new BpmWorker()
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { trackId, bpm, firstBeatMs, confidence, error } = e.data as {
        trackId: string
        bpm: number
        firstBeatMs: number
        confidence: number
        error?: string
      }

      if (error) {
        console.warn('[BpmWorker]', error)
        setAnalyzingBpm(false)
        return
      }

      const info: BpmInfo = { bpm, firstBeatMs, confidence }
      bpmCache.current[trackId] = info
      writeBpmCache(bpmCache.current)

      // Apply only if this track is still the active one
      const current = usePlayerStore.getState().currentTrack
      if (current?.id === trackId) {
        engine.updateCurrentBpmInfo(bpm, firstBeatMs)
        setBpmAnalysisResult(bpm, confidence)
      }
    }

    // ── Engine → next track ───────────────────────────────────────────────
    engine.onRequestNextTrack = (currentId: string) => {
      const { queue, repeatMode } = usePlayerStore.getState()
      const idx = queue.findIndex(t => t.id === currentId)

      let nextTrack = null
      if (idx >= 0 && idx < queue.length - 1) {
        nextTrack = queue[idx + 1]
      } else if (repeatMode === 'all' && queue.length > 0) {
        nextTrack = queue[0]
      }

      if (!nextTrack) return

      const bpmInfo = bpmCache.current[nextTrack.id]
      const url     = `${SERVER_URL}/stream/${nextTrack.id}`

      // Mark as engine-driven BEFORE updating the store so the
      // currentTrack effect below knows to skip re-loading this track.
      engineDrivenId.current = nextTrack.id

      engine.crossfadeTo(url, nextTrack.id, bpmInfo?.bpm ?? 0, bpmInfo?.firstBeatMs ?? 0)

      // Update the player store so the UI (PlayerBar, overlay) follows along
      usePlayerStore.getState().playTrack(nextTrack)
    }

    // ── Engine → prebuffer next track ─────────────────────────────────────
    engine.onRequestPrebuffer = (currentId: string) => {
      const { queue } = usePlayerStore.getState()
      const idx       = queue.findIndex(t => t.id === currentId)
      if (idx < 0 || idx >= queue.length - 1) return

      const nextTrack = queue[idx + 1]
      const bpmInfo   = bpmCache.current[nextTrack.id]
      const url       = `${SERVER_URL}/stream/${nextTrack.id}`

      engine.prebufferTrack(url, nextTrack.id, bpmInfo?.bpm ?? 0, bpmInfo?.firstBeatMs ?? 0)

      // Pre-analyse BPM so it's ready at crossfade time
      if (!bpmCache.current[nextTrack.id]) {
        analyzeBpm(url, nextTrack.id)
      }
    }

    // ── Engine state → stores ─────────────────────────────────────────────
    engine.setListener((state) => {
      lastEnginePlayingRef.current = state.isPlaying
      usePlayerStore.setState({
        isPlaying:   state.isPlaying,
        currentTime: state.positionMs / 1000,
        duration:    state.durationMs / 1000,
      })
      syncEngineState(state)
    })

    // ── Subscribe: user play/pause ────────────────────────────────────────
    // usePlayerStore must have subscribeWithSelector middleware for this to work.
    const unsubPlaying = usePlayerStore.subscribe(
      (s) => s.isPlaying,
      (isPlaying) => {
        // Only act when the USER changed it — not when the engine updated the store
        if (isPlaying !== lastEnginePlayingRef.current) {
          engineRef.current?.playPause()
        }
      }
    )

    // ── Subscribe: user seek (drift > 1.5 s = explicit seek) ─────────────
    const unsubSeek = usePlayerStore.subscribe(
      (s) => s.currentTime,
      (time) => {
        const engineMs = engineRef.current?.getCurrentPositionMs() ?? 0
        const storeMs  = time * 1000
        if (Math.abs(storeMs - engineMs) > 1500) {
          engineRef.current?.seekTo(storeMs)
        }
      }
    )

    // ── Subscribe: volume changes ─────────────────────────────────────────
    const unsubVol = usePlayerStore.subscribe(
      (s) => s.volume,
      (vol) => { engineRef.current?.setVolume(vol) }
    )

    return () => {
      unsubPlaying()
      unsubSeek()
      unsubVol()
      engine.dispose()
      worker.terminate()
      decodeCtxRef.current?.close()
      engineRef.current = null
      workerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync settings changes to engine ──────────────────────────────────────

  useEffect(() => {
    const eng = engineRef.current
    if (!eng) return
    eng.crossfadeDurationMs = crossfadeDurationMs
    eng.cuePointOffsetMs    = cuePointOffsetMs
    eng.useHalfwayMix       = useHalfwayMix
  }, [crossfadeDurationMs, cuePointOffsetMs, useHalfwayMix])

  // ── Handle currentTrack changes ───────────────────────────────────────────
  // On first mount after Auto Mix is enabled, currentTrack is already set
  // (we called playTrack() in PlaylistAutoMixPanel.handleStart). The effect
  // fires on mount because it's a fresh component, so the engine starts
  // playing immediately with no extra wiring needed.

  const currentTrack = usePlayerStore(s => s.currentTrack)
  const volume       = usePlayerStore(s => s.volume)

  useEffect(() => {
    if (!currentTrack) return

    const engine = engineRef.current
    if (!engine) return

    // Engine-driven crossfade — engine is already handling this track
    if (engineDrivenId.current === currentTrack.id) {
      engineDrivenId.current = null
      const cached = bpmCache.current[currentTrack.id]
      if (cached) engine.updateCurrentBpmInfo(cached.bpm, cached.firstBeatMs)
      return
    }

    // User-initiated change (including the initial play when Auto Mix starts)
    engine.abort()
    const url = `${SERVER_URL}/stream/${currentTrack.id}`
    engine.startTrack(url, currentTrack.id)
    engine.setVolume(volume)

    const cached = bpmCache.current[currentTrack.id]
    if (cached) {
      engine.updateCurrentBpmInfo(cached.bpm, cached.firstBeatMs)
      setBpmAnalysisResult(cached.bpm, cached.confidence)
    } else {
      analyzeBpm(url, currentTrack.id)
    }
  }, [currentTrack?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

// ══════════════════════════════════════════════════════════════════════════
// DJEngine — shell that activates DJEngineCore only when Auto Mix is on
// ══════════════════════════════════════════════════════════════════════════

export function DJEngine() {
  const isEnabled = useAutoMixStore(s => s.isEnabled)
  if (!isEnabled) return null
  return <DJEngineCore />
}