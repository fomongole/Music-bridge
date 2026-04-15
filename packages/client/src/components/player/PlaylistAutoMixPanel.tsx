/**
 * PlaylistAutoMixPanel.tsx
 *
 * Auto-Mix control panel embedded exclusively in the playlist view header.
 * This component never appears in the library — only in user-created playlists.
 *
 * Behaviour:
 *  - "Start Auto Mix" → stops any current playback immediately, sets the
 *    playlist as the queue, enables DJEngine, begins playing from track 1.
 *  - "Stop Auto Mix"  → disables DJEngine, halts all playback.
 *  - All crossfade / cue-point settings are persisted by useAutoMixStore.
 *  - Shows live BPM, confidence badge, time-to-next-mix, and a crossfade
 *    progress indicator on the trigger button.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Disc3, ChevronDown, Zap, Clock, Music2,
  BarChart2, Play, StopCircle, AlertCircle,
} from 'lucide-react'
import { useAutoMixStore, CUE_POINT_OPTIONS_MS } from '../../store/useAutoMixStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import type { Track } from '../../types/Track'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.70) return { label: 'High',   color: 'text-emerald-500' }
  if (c >= 0.45) return { label: 'Medium', color: 'text-amber-500'   }
  if (c  > 0)    return { label: 'Low',    color: 'text-rose-500'    }
  return                 { label: '—',     color: 'text-slate-400'   }
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  /** Ordered list of tracks currently shown in this playlist. */
  tracks: Track[]
}

export function PlaylistAutoMixPanel({ tracks }: Props) {
  const [open, setOpen] = useState(false)
  const panelRef        = useRef<HTMLDivElement>(null)

  const {
    isEnabled,
    crossfadeDurationMs, cuePointOffsetMs, useHalfwayMix,
    isCrossfading, crossfadeProgress,
    currentBpm, currentConfidence,
    isAnalyzingBpm, timeToNextMixMs, engineError,
    setEnabled, setCrossfadeDuration, setCuePointOffset, toggleHalfwayMix, clearError,
  } = useAutoMixStore()

  const { setQueue, playTrack } = usePlayerStore()

  const { label: confLabel, color: confColor } = confidenceLabel(currentConfidence)
  const canStart = tracks.length >= 2

  // ── Close panel on outside click ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Start Auto Mix ────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (!canStart) return

    // 1. Stop anything currently playing (AudioEngine respects isEnabled flag)
    usePlayerStore.setState({ isPlaying: false })

    // 2. Load the playlist into the queue
    setQueue(tracks)

    // 3. Mount DJEngineCore by enabling auto-mix
    setEnabled(true)

    // 4. Start the first track — DJEngineCore's currentTrack effect will
    //    call engine.startTrack() once it sees this change on mount.
    playTrack(tracks[0])

    setOpen(false)
  }, [canStart, tracks, setQueue, playTrack, setEnabled])

  // ── Stop Auto Mix ─────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    setEnabled(false)
    usePlayerStore.setState({ isPlaying: false })
  }, [setEnabled])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={panelRef} className="relative shrink-0">

      {/* ── Trigger button ────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold
          transition-all duration-200 select-none shadow-md
          ${isEnabled
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
            : 'bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-slate-900/10 dark:shadow-white/5'}
        `}
        title="Auto Mix settings"
      >
        <Disc3 className={`w-4 h-4 ${isEnabled ? 'animate-spin [animation-duration:3s]' : ''}`} />
        <span>{isEnabled ? 'Auto Mixing' : 'Auto Mix'}</span>

        {/* Pulse dot during crossfade */}
        {isEnabled && isCrossfading && (
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        )}

        {/* Live BPM when active and not currently fading */}
        {isEnabled && currentBpm > 0 && !isCrossfading && (
          <span className="text-xs opacity-75 font-normal tabular-nums">
            {currentBpm.toFixed(0)} BPM
          </span>
        )}

        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Crossfade progress strip on trigger button */}
      {isEnabled && isCrossfading && (
        <div className="absolute -bottom-1 left-5 right-5 h-0.5 bg-indigo-300/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 transition-all duration-100"
            style={{ width: `${crossfadeProgress * 100}%` }}
          />
        </div>
      )}

      {/* ── Settings dropdown ─────────────────────────────────────────────── */}
      {open && (
        <div
          className="
            absolute top-full right-0 mt-3 z-50 w-80
            bg-white dark:bg-zinc-900
            border border-slate-200 dark:border-white/10
            rounded-2xl shadow-2xl p-5 space-y-5
          "
        >

          {/* Header row */}
          <div className="flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white flex-1">Auto Mix</span>
            {isEnabled && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            )}
          </div>

          {/* BPM badge */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
            <BarChart2 className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
                Current BPM
              </p>
              {isAnalyzingBpm ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-4 bg-slate-200 dark:bg-zinc-700 rounded animate-pulse" />
                  <span className="text-[10px] text-slate-400">Analyzing…</span>
                </div>
              ) : currentBpm > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {currentBpm.toFixed(1)}
                  </span>
                  <span className={`text-[10px] font-semibold ${confColor}`}>
                    {confLabel} confidence
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">
                  {isEnabled ? 'Detecting…' : 'Not active'}
                </span>
              )}
            </div>
          </div>

          {/* Time to next mix (live, only when active) */}
          {isEnabled && timeToNextMixMs !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl
              bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex-1">
                {timeToNextMixMs <= 0 ? 'Mixing now…' : `Next mix in ${fmtMs(timeToNextMixMs)}`}
              </span>
              {isCrossfading && (
                <div className="flex gap-0.5 items-end h-3">
                  <div className="w-0.5 bg-indigo-500 h-1 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-0.5 bg-indigo-500 h-3 animate-bounce" style={{ animationDelay: '100ms' }} />
                  <div className="w-0.5 bg-indigo-500 h-2 animate-bounce" style={{ animationDelay: '200ms' }} />
                </div>
              )}
            </div>
          )}

          {/* Crossfade progress (during active fade) */}
          {isEnabled && isCrossfading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                <span>Crossfading…</span>
                <span>{Math.round(crossfadeProgress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-100"
                  style={{ width: `${crossfadeProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-white/5" />

          {/* Crossfade duration slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Crossfade Duration
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {(crossfadeDurationMs / 1000).toFixed(0)}s
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={12000}
              step={500}
              value={crossfadeDurationMs}
              onChange={e => setCrossfadeDuration(Number(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer
                bg-slate-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-0.5">
              <span>2s</span><span>7s</span><span>12s</span>
            </div>
          </div>

          {/* Cue-point offset selector */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
              <Music2 className="w-3.5 h-3.5" /> Mix Cue Point
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {CUE_POINT_OPTIONS_MS.map(ms => (
                <button
                  key={ms}
                  onClick={() => setCuePointOffset(ms)}
                  className={`
                    py-1.5 rounded-lg text-[11px] font-bold transition-all
                    ${cuePointOffsetMs === ms
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}
                  `}
                >
                  {ms === 0 ? 'Off' : `${ms / 1000}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Halfway Mix toggle */}
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Halfway Mix
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Begin mix at 50% of track duration
              </p>
            </div>
            <button
              onClick={toggleHalfwayMix}
              className={`
                relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0
                ${useHalfwayMix ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-700'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow
                  transition-transform duration-200
                  ${useHalfwayMix ? 'translate-x-4' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          {/* Not enough tracks warning */}
          {!canStart && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl
              bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Add at least 2 tracks to enable Auto Mix.
              </span>
            </div>
          )}

          {/* Engine error */}
          {engineError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl
              bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
              <span className="text-xs text-rose-600 dark:text-rose-400 flex-1 break-words">
                {engineError}
              </span>
              <button
                onClick={clearError}
                className="text-rose-400 hover:text-rose-600 shrink-0 text-xs ml-1"
              >
                ✕
              </button>
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-white/5" />

          {/* Primary CTA */}
          {isEnabled ? (
            <button
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20
                border border-rose-200 dark:border-rose-500/20
                text-rose-600 dark:text-rose-400 font-semibold text-sm
                transition-all"
            >
              <StopCircle className="w-4 h-4" />
              Stop Auto Mix
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                bg-indigo-600 hover:bg-indigo-700
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600
                text-white font-semibold text-sm
                transition-all shadow-md shadow-indigo-600/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Auto Mix
            </button>
          )}

          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            BPM is detected automatically per track.{' '}
            {isEnabled
              ? 'Tracks will crossfade continuously.'
              : 'Starts from the first track in this playlist.'}
          </p>

        </div>
      )}
    </div>
  )
}