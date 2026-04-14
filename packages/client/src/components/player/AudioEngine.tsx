import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { 
    currentTrack, 
    isPlaying, 
    volume, 
    playNext, 
    togglePlay,
    setAudioElement,
    setCurrentTime,
    setDuration
  } = usePlayerStore()

  // Register the audio element with Zustand on mount
  useEffect(() => {
    setAudioElement(audioRef.current)
  }, [setAudioElement])

  // Handle Track Changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    audio.src = `http://localhost:3001/stream/${currentTrack.id}`
    audio.load()
    
    if (isPlaying) {
      audio.play().catch(console.error)
    }
  }, [currentTrack?.id])

  // Handle Play/Pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (isPlaying) {
      audio.play().catch(() => togglePlay())
    } else {
      audio.pause()
    }
  }, [isPlaying, currentTrack])

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  return (
    <audio
      ref={audioRef}
      onEnded={() => playNext(true)} // Passing true so the store knows it ended naturally
      onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      onLoadedMetadata={() => setDuration(audioRef.current?.duration || currentTrack?.duration || 0)}
      className="hidden"
    />
  )
}