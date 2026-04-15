/**
 * AutoMixPanel.tsx
 *
 * Compact DJ auto-mix control panel.
 * Designed to slot into the PlayerBar as a collapsible popover.
 *
 * Shows:
 *  • Auto-Mix ON/OFF toggle with animated indicator
 *  • Live BPM + confidence badge for the current track
 *  • Crossfade duration slider (2–12 s)
 *  • Cue-point offset selector (0–30 s)
 *  • Halfway-mix vs max-duration toggle
 *  • Time-to-next-mix countdown
 *  • Crossfade progress bar
 */

import { useRef, useEffect, useState } from 'react'
import { Disc3, ChevronDown, Zap, Clock, Music2, BarChart2 } from 'lucide-react'
import { useAutoMixStore, CUE_POINT_OPTIONS_MS } from '../../store/useAutoMixStore'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.70) return { label: 'High',   color: 'text-emerald-500' }
  if (c >= 0.45) return { label: 'Medium', color: 'text-amber-500'   }
  if (c > 0)     return { label: 'Low',    color: 'text-rose-500'    }
  return                  { label: '—',    color: 'text-slate-400'   }
}

// ── AutoMixPanel ──────────────────────────────────────────────────────────

export function AutoMixPanel() {
  const [open, setOpen] = useState(false)
  const panelRef        = useRef<HTMLDivElement>(null)

  const {
    isEnabled, crossfadeDurationMs, cuePointOffsetMs, useHalfwayMix,
    isCrossfading, crossfadeProgress, currentBpm, currentConfidence,
    isAnalyzingBpm, timeToNextMixMs, engineError,
    toggleEnabled, setCrossfadeDuration, setCuePointOffset, toggleHalfwayMix, clearError,
  } = useAutoMixStore()

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { label: confLabel, color: confColor } = confidenceLabel(currentConfidence)

  return (
    <div ref={panelRef} className="relative">

      {/* ── Trigger button ────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold
          transition-all duration-200 select-none
          ${isEnabled
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-slate-400'}
        `}
        title="Auto-Mix settings"
      >
        <Disc3 className={`w-3.5 h-3.5 ${isEnabled ? 'animate-spin [animation-duration:3s]' : ''}`} />
        <span className="hidden sm:inline">AUTO MIX</span>
        {isEnabled && isCrossfading && (
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Crossfade progress bar (shown inline when fading) ─────────── */}
      {isEnabled && isCrossfading && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all"
            style={{ width: `${crossfadeProgress * 100}%` }}
          />
        </div>
      )}

      {/* ── Settings popover ──────────────────────────────────────────── */}
      {open && (
        <div className="
          absolute bottom-12 right-0 z-50 w-72
          bg-white dark:bg-zinc-900
          border border-slate-200 dark:border-white/10
          rounded-2xl shadow-2xl p-4 space-y-4
        ">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Auto-Mix</span>
            </div>

            {/* Master toggle */}
            <button
              onClick={toggleEnabled}
              className={`
                relative w-11 h-6 rounded-full transition-colors duration-200
                ${isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-700'}
              `}
            >
              <span className={`
                absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                transition-transform duration-200
                ${isEnabled ? 'translate-x-5' : 'translate-x-0'}
              `} />
            </button>
          </div>

          {/* ── BPM Badge ──────────────────────────────────────────────── */}
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
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
          </div>

          {/* ── Time to next mix ───────────────────────────────────────── */}
          {isEnabled && timeToNextMixMs !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl
              bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {timeToNextMixMs <= 0 ? 'Mixing now…' : `Next mix in ${fmtMs(timeToNextMixMs)}`}
              </span>
              {isCrossfading && (
                <div className="ml-auto flex gap-0.5 items-end h-3">
                  <div className="w-0.5 bg-indigo-500 h-1 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-0.5 bg-indigo-500 h-3 animate-bounce" style={{ animationDelay: '100ms' }} />
                  <div className="w-0.5 bg-indigo-500 h-2 animate-bounce" style={{ animationDelay: '200ms' }} />
                </div>
              )}
            </div>
          )}

          {/* ── Crossfade Duration ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Crossfade
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {(crossfadeDurationMs / 1000).toFixed(0)}s
              </span>
            </div>
            <input
              type="range" min={2000} max={12000} step={500}
              value={crossfadeDurationMs}
              onChange={e => setCrossfadeDuration(Number(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer
                bg-slate-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-0.5">
              <span>2s</span><span>7s</span><span>12s</span>
            </div>
          </div>

          {/* ── Cue Point Offset ───────────────────────────────────────── */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
              <Music2 className="w-3.5 h-3.5" /> Cue Point
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

          {/* ── Mix Mode ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Halfway Mix
            </span>
            <button
              onClick={toggleHalfwayMix}
              className={`
                relative w-9 h-5 rounded-full transition-colors duration-200
                ${useHalfwayMix ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-700'}
              `}
            >
              <span className={`
                absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow
                transition-transform duration-200
                ${useHalfwayMix ? 'translate-x-4' : 'translate-x-0'}
              `} />
            </button>
          </div>

          {/* ── Error ──────────────────────────────────────────────────── */}
          {engineError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl
              bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
              <span className="text-xs text-rose-600 dark:text-rose-400 flex-1">{engineError}</span>
              <button onClick={clearError} className="text-rose-400 hover:text-rose-600 shrink-0 text-xs">✕</button>
            </div>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed px-1">
            BPM detected automatically.{' '}
            {isEnabled ? 'Tracks will crossfade at the halfway point.' : 'Enable to start auto-crossfading.'}
          </p>
        </div>
      )}
    </div>
  )
}