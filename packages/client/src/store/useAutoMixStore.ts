/**
 * useAutoMixStore.ts
 *
 * Zustand store for all Auto-Mix state — both user-configurable settings
 * and live engine state surfaced to the UI.
 *
 * Settings are persisted to localStorage so they survive page refreshes.
 * Engine state is ephemeral (re-populated by DJEngine on mount).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EngineState } from '../engine/AutoMixEngine'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AutoMixSettings {
  isEnabled:          boolean
  crossfadeDurationMs: number   // 2 000 – 12 000
  cuePointOffsetMs:   number    // 0 | 5000 | 10000 | 15000 | 20000 | 30000
  useHalfwayMix:      boolean
}

export interface AutoMixLiveState {
  isCrossfading:      boolean
  crossfadeProgress:  number    // 0–1
  currentBpm:         number
  currentConfidence:  number    // 0–1  (from BPM analysis)
  isAnalyzingBpm:     boolean
  timeToNextMixMs:    number | null
  engineError:        string | null
}

type AutoMixStore = AutoMixSettings & AutoMixLiveState & {
  // Settings actions
  toggleEnabled:        () => void
  setEnabled:           (v: boolean) => void
  setCrossfadeDuration: (ms: number) => void
  setCuePointOffset:    (ms: number) => void
  toggleHalfwayMix:     () => void

  // Engine state updates (called by DJEngine)
  syncEngineState:      (s: Partial<EngineState>) => void
  setBpmAnalysisResult: (bpm: number, confidence: number) => void
  setAnalyzingBpm:      (v: boolean) => void
  clearError:           () => void
}

// ── Cue-point options (mirrors Android CUE_POINT_OPTIONS_SEC) ──────────────

export const CUE_POINT_OPTIONS_MS = [0, 5_000, 10_000, 15_000, 20_000, 30_000]

// ── Store ──────────────────────────────────────────────────────────────────

export const useAutoMixStore = create<AutoMixStore>()(
  persist(
    (set) => ({
      // ── Persisted settings ───────────────────────────────────────────────
      isEnabled:           false,
      crossfadeDurationMs: 6_000,
      cuePointOffsetMs:    15_000,
      useHalfwayMix:       true,

      // ── Ephemeral live state ─────────────────────────────────────────────
      isCrossfading:       false,
      crossfadeProgress:   0,
      currentBpm:          0,
      currentConfidence:   0,
      isAnalyzingBpm:      false,
      timeToNextMixMs:     null,
      engineError:         null,

      // ── Settings actions ─────────────────────────────────────────────────
      toggleEnabled:        () => set(s => ({ isEnabled: !s.isEnabled })),
      setEnabled:           (v) => set({ isEnabled: v }),
      setCrossfadeDuration: (ms) => set({ crossfadeDurationMs: ms }),
      setCuePointOffset:    (ms) => set({ cuePointOffsetMs: ms }),
      toggleHalfwayMix:     () => set(s => ({ useHalfwayMix: !s.useHalfwayMix })),

      // ── Engine sync ──────────────────────────────────────────────────────
      syncEngineState: (s) => set({
        isCrossfading:     s.isCrossfading     ?? false,
        crossfadeProgress: s.crossfadeProgress ?? 0,
        currentBpm:        s.currentBpm        ?? 0,
        timeToNextMixMs:   s.timeToNextMixMs   ?? null,
        engineError:       s.error             ?? null,
      }),

      setBpmAnalysisResult: (bpm, confidence) => set({
        currentBpm: bpm,
        currentConfidence: confidence,
        isAnalyzingBpm: false,
      }),

      setAnalyzingBpm: (v) => set({ isAnalyzingBpm: v }),
      clearError:      () => set({ engineError: null }),
    }),
    {
      name:    'music-bridge-automix-settings',
      // Only persist settings, not live engine state
      partialize: (s) => ({
        isEnabled:           s.isEnabled,
        crossfadeDurationMs: s.crossfadeDurationMs,
        cuePointOffsetMs:    s.cuePointOffsetMs,
        useHalfwayMix:       s.useHalfwayMix,
      }),
    }
  )
)