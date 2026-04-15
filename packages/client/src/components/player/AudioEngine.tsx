/**
 * AudioEngine.tsx
 *
 * Standard HTML audio engine for normal (non-auto-mix) playback.
 *
 * When the Auto Mix DJEngine is active (isEnabled === true), this component
 * yields completely: it pauses its audio element, clears the src, and
 * unregisters itself from the player store so the DJEngine owns all playback.
 * When Auto Mix is turned off, this engine re-registers and resumes control.
 */

import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useAutoMixStore } from '../../store/useAutoMixStore'
import { SERVER_URL } from '../../config'

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement>(null)

  const isAutoMixEnabled = useAutoMixStore(s => s.isEnabled)

  const {
    currentTrack,
    isPlaying,
    volume,
    playNext,
    togglePlay,
    setAudioElement,
    setCurrentTime,
    setDuration,
  } = usePlayerStore()

  // ── Register / unregister with the player store ──────────────────────────
  // When auto-mix is active, set audioElement to null so seek() and other
  // store actions don't try to control this element.
  useEffect(() => {
    if (isAutoMixEnabled) {
      // Hand control over to DJEngine — stop and release this element
      setAudioElement(null)
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.src = ''
        audio.load()
      }
    } else {
      // Reclaim control
      setAudioElement(audioRef.current)
    }
  }, [isAutoMixEnabled, setAudioElement])

  // Initial registration on mount
  useEffect(() => {
    setAudioElement(audioRef.current)
    return () => setAudioElement(null)
  }, [setAudioElement])

  // ── Track changes ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAutoMixEnabled) return
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    audio.src = `${SERVER_URL}/stream/${currentTrack.id}`
    audio.load()

    if (isPlaying) {
      audio.play().catch(console.error)
    }
  }, [currentTrack?.id, isAutoMixEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / Pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAutoMixEnabled) return
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (isPlaying) {
      audio.play().catch(() => togglePlay())
    } else {
      audio.pause()
    }
  }, [isPlaying, isAutoMixEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (audio && !isAutoMixEnabled) {
      audio.volume = volume
    }
  }, [volume, isAutoMixEnabled])

  return (
    <audio
      ref={audioRef}
      onEnded={() => {
        if (!isAutoMixEnabled) playNext(true)
      }}
      onTimeUpdate={() => {
        if (!isAutoMixEnabled && audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
      }}
      onLoadedMetadata={() => {
        if (!isAutoMixEnabled && audioRef.current) {
          setDuration(audioRef.current.duration || currentTrack?.duration || 0)
        }
      }}
      className="hidden"
    />
  )
}