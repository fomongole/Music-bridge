import { create } from 'zustand'
import type { Track } from '../types/Track'

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  originalQueue: Track[]
  isPlaying: boolean
  volume: number
  isOverlayOpen: boolean
  
  currentTime: number
  duration: number
  audioElement: HTMLAudioElement | null
  
  isShuffle: boolean
  repeatMode: 'off' | 'all' | 'one'
  
  // Actions
  setQueue: (tracks: Track[]) => void
  playTrack: (track: Track) => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  playNext: (autoEnded?: boolean) => void
  playPrev: () => void
  toggleOverlay: () => void
  
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setAudioElement: (el: HTMLAudioElement | null) => void
  seek: (time: number) => void
  
  toggleShuffle: () => void
  toggleRepeat: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  isPlaying: false,
  volume: 1,
  isOverlayOpen: false,
  
  currentTime: 0,
  duration: 0,
  audioElement: null,

  isShuffle: false,
  repeatMode: 'off',

  setQueue: (tracks) => {
    const { isShuffle } = get()
    if (isShuffle) {
      // True random Fisher-Yates shuffle
      const shuffled = [...tracks]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      set({ originalQueue: tracks, queue: shuffled })
    } else {
      set({ originalQueue: tracks, queue: tracks })
    }
  },
  
  playTrack: (track) => {
    // FIX: Removed the unused originalQueue to clear the TS warning
    const { isShuffle, queue } = get() 
    
    // If shuffle is active when a new track is clicked, ensure it's at the start of the queue
    if (isShuffle) {
      const remaining = queue.filter(t => t.id !== track.id)
      set({ currentTrack: track, isPlaying: true, queue: [track, ...remaining] })
    } else {
      set({ currentTrack: track, isPlaying: true })
    }
  },
  
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setVolume: (volume) => set({ volume }),
  
  playNext: (autoEnded = false) => {
    const { currentTrack, queue, repeatMode, seek } = get()
    if (!currentTrack || queue.length === 0) return

    // If the track ended naturally and repeat mode is 'one', replay it
    if (autoEnded && repeatMode === 'one') {
      seek(0)
      const { audioElement } = get()
      if (audioElement) audioElement.play().catch(console.error)
      return
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
    const isLastTrack = currentIndex === queue.length - 1

    // If it's the last track, ended naturally, and no repeat is on, stop playing
    if (autoEnded && isLastTrack && repeatMode === 'off') {
      set({ isPlaying: false })
      seek(0)
      return
    }

    // Otherwise, move to the next track (looping back to start if needed)
    const nextIndex = (currentIndex + 1) % queue.length
    set({ currentTrack: queue[nextIndex], isPlaying: true })
  },
  
  playPrev: () => {
    const { currentTrack, queue, currentTime, seek } = get()
    if (!currentTrack || queue.length === 0) return

    // Standard player behavior: if more than 3 seconds in, restart the current track instead of going back
    if (currentTime > 3) {
      seek(0)
      return
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length
    set({ currentTrack: queue[prevIndex], isPlaying: true })
  },

  toggleOverlay: () => set((state) => ({ isOverlayOpen: !state.isOverlayOpen })),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setAudioElement: (el) => set({ audioElement: el }),
  
  seek: (time) => {
    const { audioElement } = get()
    if (audioElement) audioElement.currentTime = time
    set({ currentTime: time })
  },

  toggleShuffle: () => {
    const { isShuffle, originalQueue, currentTrack } = get()
    if (!isShuffle) {
      // Turn Shuffle ON: Mix the remaining queue, keep current track at index 0
      const remaining = [...originalQueue].filter(t => t.id !== currentTrack?.id)
      
      // True random Fisher-Yates shuffle
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]]
      }
      
      set({ isShuffle: true, queue: currentTrack ? [currentTrack, ...remaining] : remaining })
    } else {
      // Turn Shuffle OFF: Restore original queue
      set({ isShuffle: false, queue: originalQueue })
    }
  },

  toggleRepeat: () => {
    const { repeatMode } = get()
    const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
    set({ repeatMode: nextMode })
  }
}))