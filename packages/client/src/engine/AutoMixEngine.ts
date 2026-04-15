/**
 * AutoMixEngine.ts
 *
 * Web Audio API dual-player crossfade engine.
 * Spiritual port of the Android CrossfadeEngine — pure TypeScript class,
 * no React dependencies. All times are in milliseconds internally.
 *
 * Architecture:
 *   HTMLAudioElement A → MediaElementSourceNode A → BiquadFilterNode A (highpass bass-cut) → GainNode A ─┐
 *   HTMLAudioElement B → MediaElementSourceNode B → BiquadFilterNode B (highpass bass-cut) → GainNode B ─┴→ destination
 *
 * Thread safety note:
 *   All AudioContext operations must happen on the main thread.
 *   This class is designed to be used from the main thread only.
 */

// ── Public Types ───────────────────────────────────────────────────────────

export interface BpmInfo {
  bpm: number
  firstBeatMs: number
  confidence: number
}

export interface EngineState {
  currentTrackId: string | null
  isPlaying: boolean
  isCrossfading: boolean
  crossfadeProgress: number  // 0–1
  positionMs: number
  durationMs: number
  timeToNextMixMs: number | null
  currentBpm: number
  error: string | null
}

export type EngineStateListener = (state: EngineState) => void

// ── Constants ──────────────────────────────────────────────────────────────

const FADE_STEPS           = 60
const CROSSFADE_GUARD_MS   = 200
const BEAT_SNAP_WINDOW_MS  = 25
const GUARD_MAX_ITERATIONS = 1_000
const MONITOR_INTERVAL_MS  = 200   // normal polling
// const FAST_INTERVAL_MS     = 50    // fast-zone polling

export class AutoMixEngine {
  private ctx:     AudioContext | null = null
  private elemA:   HTMLAudioElement | null = null
  private elemB:   HTMLAudioElement | null = null
  private srcA:    MediaElementAudioSourceNode | null = null
  private srcB:    MediaElementAudioSourceNode | null = null
  private filterA: BiquadFilterNode | null = null
  private filterB: BiquadFilterNode | null = null
  private gainA:   GainNode | null = null
  private gainB:   GainNode | null = null
  private isPrimA  = true

  // ── User-configurable settings ───────────────────────────────────────────
  crossfadeDurationMs = 6_000
  cuePointOffsetMs    = 15_000
  useHalfwayMix       = true
  maxTrackDurationMs  = 180_000

  // ── Current-track metadata ───────────────────────────────────────────────
  private curBpm         = 0
  private curFirstBeatMs = 0   // always the GUARDED value
  private userVolume     = 1.0

  // ── Pre-buffered next track ──────────────────────────────────────────────
  private prebufId: string | null = null

  // ── Lifecycle tracking ───────────────────────────────────────────────────
  private fading         = false
  private abortFade      = false
  private monitorId:     ReturnType<typeof setInterval> | null = null
  private lastReqId:     string | null = null
  private lastPrebufReqId: string | null = null
  private guardUntilMs   = 0
  private initialized    = false

  // ── State & listener ─────────────────────────────────────────────────────
  private _state: EngineState = {
    currentTrackId: null, isPlaying: false, isCrossfading: false,
    crossfadeProgress: 0, positionMs: 0, durationMs: 0,
    timeToNextMixMs: null, currentBpm: 0, error: null,
  }
  private listener: EngineStateListener | null = null

  // ── External callbacks (set by DJEngine React component) ─────────────────
  onRequestNextTrack:  ((id: string) => void) | null = null
  onRequestPrebuffer:  ((id: string) => void) | null = null

  // ═══════════════════════════════════════════════════════════════════════
  // INIT / TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════

  initialize(): void {
    if (this.initialized) return

    this.ctx = new AudioContext()

    // Create two independent audio elements
    const mkEl = () => {
      const el = new Audio()
      el.crossOrigin  = 'anonymous'
      el.preload      = 'auto'
      return el
    }

    this.elemA = mkEl()
    this.elemB = mkEl()

    // Build the Web Audio graph with highpass filters for gradual bass removal on outgoing track
    this.srcA  = this.ctx.createMediaElementSource(this.elemA)
    this.filterA = this.ctx.createBiquadFilter()
    this.filterA.type = 'highpass'
    this.filterA.frequency.value = 20
    this.filterA.Q.value = 0.7
    this.gainA = this.ctx.createGain()
    this.srcA.connect(this.filterA)
    this.filterA.connect(this.gainA)
    this.gainA.connect(this.ctx.destination)
    this.gainA.gain.value = 1

    this.srcB  = this.ctx.createMediaElementSource(this.elemB)
    this.filterB = this.ctx.createBiquadFilter()
    this.filterB.type = 'highpass'
    this.filterB.frequency.value = 20
    this.filterB.Q.value = 0.7
    this.gainB = this.ctx.createGain()
    this.srcB.connect(this.filterB)
    this.filterB.connect(this.gainB)
    this.gainB.connect(this.ctx.destination)
    this.gainB.gain.value = 0

    // Track-ended safety net
    this.elemA.addEventListener('ended', () => this._onEnded('A'))
    this.elemB.addEventListener('ended', () => this._onEnded('B'))

    this.startMonitor()
    this.initialized = true
  }

  dispose(): void {
    this.stopMonitor()
    this.abortFade = true

    this.elemA?.pause()
    this.elemB?.pause()

    this.filterA?.disconnect()
    this.filterB?.disconnect()
    this.gainA?.disconnect()
    this.gainB?.disconnect()
    this.srcA?.disconnect()
    this.srcB?.disconnect()

    this.ctx?.close()
    this.ctx = null; this.elemA = null; this.elemB = null
    this.srcA = null; this.srcB = null
    this.filterA = null; this.filterB = null
    this.gainA = null; this.gainB = null
    this.initialized = false
  }

  setListener(fn: EngineStateListener): void { this.listener = fn }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC PLAYBACK API
  // ═══════════════════════════════════════════════════════════════════════

  startTrack(url: string, trackId: string): void {
    this._resume()
    this.abortFade  = true      // kill any running fade
    this.fading     = false
    this.lastReqId  = null
    this.lastPrebufReqId = null
    this.prebufId   = null
    this.guardUntilMs = Date.now() + 5_000

    const secondary = this._secEl()
    if (secondary) { secondary.pause(); secondary.src = '' }
    this._secGain()!.gain.value = 0

    // Reset both filters to full bass on track start
    this._primFilter()!.frequency.value = 20
    this._secFilter()!.frequency.value = 20

    const primary = this._primEl()!
    primary.src = url
    primary.load()
    this._primGain()!.gain.value = this.userVolume

    primary.play().catch(err => this._error(`Play failed: ${err.message}`))
    this._patch({ currentTrackId: trackId, isPlaying: true, error: null })
  }

  playPause(): void {
    const el = this._primEl()
    if (!el) return
    this._resume()
    if (el.paused) { el.play().catch(() => {}); this._patch({ isPlaying: true }) }
    else           { el.pause();                 this._patch({ isPlaying: false }) }
  }

  seekTo(ms: number): void {
    const el = this._primEl()
    if (el && isFinite(el.duration)) {
      el.currentTime = Math.max(0, Math.min(ms / 1000, el.duration - 0.1))
    }
  }

  setVolume(v: number): void {
    this.userVolume = Math.max(0, Math.min(1, v))
    if (!this.fading) this._primGain()!.gain.value = this.userVolume
  }

  /**
   * Update current-track BPM metadata.
   * rawFirstBeatMs is the unguarded cache value — guard applied internally.
   */
  updateCurrentBpmInfo(bpm: number, rawFirstBeatMs: number): void {
    this.curBpm         = bpm
    this.curFirstBeatMs = this._guard(rawFirstBeatMs, bpm)
    this._patch({ currentBpm: bpm })
  }

  /**
   * Pre-load the next track into the idle player.
   * rawFirstBeatMs is the unguarded value.
   */
  prebufferTrack(url: string, trackId: string, bpm: number, rawFirstBeatMs: number): void {
    if (this.fading || this.prebufId === trackId) return

    const sec = this._secEl()!
    sec.src = url
    sec.load()
    this._secGain()!.gain.value = 0

    const guarded = this._guard(rawFirstBeatMs, bpm)
    if (guarded > 0) {
      const seek = () => {
        if (isFinite(sec.duration)) sec.currentTime = guarded / 1000
        sec.removeEventListener('loadedmetadata', seek)
      }
      sec.addEventListener('loadedmetadata', seek)
    }

    this.prebufId = trackId
  }

  /**
   * Trigger crossfade to next track. rawFirstBeatMs is unguarded.
   */
  crossfadeTo(url: string, trackId: string, bpm: number, rawFirstBeatMs: number): void {
    if (this.fading) return
    this._executeFade(url, trackId, bpm, rawFirstBeatMs)
  }

  abort(): void { this.abortFade = true }

  get state(): EngineState { return this._state }
  get isCurrentlyFading(): boolean { return this.fading }

  getCurrentPositionMs(): number {
    const el = this._primEl()
    return el ? el.currentTime * 1000 : 0
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CUE POINT GUARD
  // ═══════════════════════════════════════════════════════════════════════

  private _guard(rawMs: number, bpm: number): number {
    const offset = this.cuePointOffsetMs
    if (rawMs <= 0 || bpm <= 0 || offset <= 0) return Math.max(0, rawMs)
    if (rawMs >= offset) return rawMs

    const beatMs = 60_000 / bpm
    let adj = rawMs
    let n   = 0
    while (adj < offset && n < GUARD_MAX_ITERATIONS) { adj += beatMs; n++ }
    return adj
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CROSSFADE EXECUTION
  // ═══════════════════════════════════════════════════════════════════════

  private async _executeFade(
    url: string, trackId: string, bpm: number, rawFirstBeatMs: number
  ): Promise<void> {
    if (!this.ctx || !this.gainA || !this.gainB || !this.filterA || !this.filterB) return

    this.fading    = true
    this.abortFade = false
    this._patch({ isCrossfading: true, crossfadeProgress: 0 })

    const primEl  = this._primEl()!
    const secEl   = this._secEl()!
    const primGn  = this._primGain()!
    const secGn   = this._secGain()!
    const primFlt = this._primFilter()!
    const secFlt  = this._secFilter()!

    const guardedFirstBeat = this._guard(rawFirstBeatMs, bpm)

    try {
      // 1. Load secondary if not already prebuffered
      if (this.prebufId !== trackId) {
        secEl.src = url
        secEl.load()
      }

      // 2. Wait up to 3 s for playback-ready
      await this._waitReady(secEl, 3_000)

      // 3. Seek to cue point
      if (guardedFirstBeat > 0 && isFinite(secEl.duration)) {
        const safe = Math.min(guardedFirstBeat / 1000, secEl.duration - 1)
        secEl.currentTime = Math.max(0, safe)
      }

      // 4. Start secondary muted + reset both filters to full bass
      secGn.gain.value = 0
      primFlt.frequency.value = 20
      secFlt.frequency.value = 20
      this._resume()
      await secEl.play()

      // 5. Equal-power gain ramp (cos/sin — same as Android)
      //    + gradual bass removal on outgoing track (highpass cutoff ramp)
      const primStart = primGn.gain.value
      const stepMs    = Math.max(16, this.crossfadeDurationMs / FADE_STEPS)

      for (let step = 1; step <= FADE_STEPS; step++) {
        if (this.abortFade) break

        const progress = step / FADE_STEPS
        const angle    = progress * (Math.PI / 2)

        primGn.gain.value = Math.cos(angle) * primStart
        secGn.gain.value  = Math.sin(angle) * this.userVolume

        // Nicely remove the bass gradually from the outgoing track
        // (exactly the same timing / progress curve as the volume fade)
        const BASS_CUT_START_HZ = 20
        const BASS_CUT_END_HZ   = 750
        primFlt.frequency.value = BASS_CUT_START_HZ + (BASS_CUT_END_HZ - BASS_CUT_START_HZ) * progress

        this._patch({ crossfadeProgress: progress })
        await _sleep(stepMs)
      }

      if (this.abortFade) {
        primGn.gain.value = primStart
        primFlt.frequency.value = 20   // restore full bass on abort
        secEl.pause(); secGn.gain.value = 0
        this.abortFade = false
        return
      }

      // 6. Swap players
      primEl.pause()
      primGn.gain.value = this.userVolume   // reset for next time
      secGn.gain.value  = this.userVolume
      this.isPrimA      = !this.isPrimA

      // Reset filter on the new primary track to full bass
      this._primFilter()!.frequency.value = 20

      // 7. Post-swap housekeeping
      this.prebufId     = null
      this.lastReqId    = null
      this.lastPrebufReqId = null
      this.guardUntilMs = Date.now() + this.crossfadeDurationMs

      this._patch({
        currentTrackId: trackId,
        isCrossfading: false,
        crossfadeProgress: 0,
        currentBpm: bpm,
      })

    } catch (err) {
      this._error(`Crossfade failed: ${err}`)
    } finally {
      this.fading = false
      if (this._state.isCrossfading) {
        this._patch({ isCrossfading: false, crossfadeProgress: 0 })
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POSITION MONITOR
  // ═══════════════════════════════════════════════════════════════════════

  private startMonitor(): void {
    this.monitorId = setInterval(() => this._tick(), MONITOR_INTERVAL_MS)
  }

  private stopMonitor(): void {
    if (this.monitorId !== null) { clearInterval(this.monitorId); this.monitorId = null }
  }

  private _tick(): void {
    const el = this._primEl()
    if (!el) return

    const posMs      = el.currentTime * 1000
    const durMs      = isFinite(el.duration) ? el.duration * 1000 : 0
    const remaining  = durMs - posMs
    const playing    = !el.paused && !el.ended
    const bpm        = this.curBpm
    const firstBeat  = this.curFirstBeatMs   // guarded
    const beatMs     = bpm > 0 ? 60_000 / bpm : 0

    // Mix trigger point
    const mixAtMs    = this.useHalfwayMix && durMs > 0
      ? durMs / 2 + firstBeat
      : this.maxTrackDurationMs

    const trigWin    = this.crossfadeDurationMs + (beatMs || 0)
    const prebufWin  = this.crossfadeDurationMs * 3 + (beatMs || 0)
    const inTrig     = durMs > 0 && remaining > CROSSFADE_GUARD_MS && remaining <= trigWin
    const inPrebuf   = durMs > 0 && remaining > trigWin && remaining <= prebufWin
    const isMaxTime  = durMs > 0 && posMs >= mixAtMs && remaining > this.crossfadeDurationMs
    const guardActive = Date.now() < this.guardUntilMs

    // Beat alignment
    const onBeat = beatMs > 0
      ? (() => {
          const ph = ((posMs - firstBeat) % beatMs + beatMs) % beatMs
          return ph <= BEAT_SNAP_WINDOW_MS || ph >= beatMs - BEAT_SNAP_WINDOW_MS
        })()
      : true

    const id = this._state.currentTrackId

    // Prebuffer request
    if (inPrebuf && !this.fading && id && id !== this.lastPrebufReqId) {
      this.lastPrebufReqId = id
      this.onRequestPrebuffer?.(id)
    }

    // Crossfade trigger
    const shouldTrigger = playing && !this.fading && !guardActive
      && durMs > 0 && (inTrig || isMaxTime) && onBeat

    if (shouldTrigger && id && id !== this.lastReqId) {
      this.lastReqId = id
      this.onRequestNextTrack?.(id)
    }

    // Time-to-next-mix
    let timeToNextMixMs: number | null = null
    if (!this.fading && playing && durMs > 0) {
      if (inTrig || isMaxTime)            timeToNextMixMs = 0
      else if (mixAtMs > 0 && posMs < mixAtMs) timeToNextMixMs = mixAtMs - posMs
    }

    this._patch({ positionMs: posMs, durationMs: durMs, isPlaying: playing, timeToNextMixMs })
  }

  private _onEnded(player: 'A' | 'B'): void {
    const isPrimary = (player === 'A' && this.isPrimA) || (player === 'B' && !this.isPrimA)
    if (!isPrimary || this.fading) return
    const id = this._state.currentTrackId
    if (id && id !== this.lastReqId) {
      this.lastReqId = id
      this.onRequestNextTrack?.(id)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private _primEl():  HTMLAudioElement | null { return this.isPrimA ? this.elemA : this.elemB }
  private _secEl():   HTMLAudioElement | null { return this.isPrimA ? this.elemB : this.elemA }
  private _primGain(): GainNode | null        { return this.isPrimA ? this.gainA : this.gainB }
  private _secGain(): GainNode | null         { return this.isPrimA ? this.gainB : this.gainA }
  private _primFilter(): BiquadFilterNode | null { return this.isPrimA ? this.filterA : this.filterB }
  private _secFilter(): BiquadFilterNode | null  { return this.isPrimA ? this.filterB : this.filterA }

  private _resume(): void {
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  private _waitReady(el: HTMLAudioElement, timeoutMs: number): Promise<void> {
    return new Promise(resolve => {
      if (el.readyState >= 2) { resolve(); return }
      const t = setTimeout(resolve, timeoutMs)
      const h = () => { clearTimeout(t); el.removeEventListener('canplay', h); resolve() }
      el.addEventListener('canplay', h)
    })
  }

  private _patch(partial: Partial<EngineState>): void {
    this._state = { ...this._state, ...partial }
    this.listener?.(this._state)
  }

  private _error(msg: string): void {
    console.error('[AutoMixEngine]', msg)
    this.fading = false
    this._patch({ error: msg, isCrossfading: false, crossfadeProgress: 0 })
  }
}

function _sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}