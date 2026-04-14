import { create } from 'zustand'
import type { Track } from '../types/Track'

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  volume: number
  isOverlayOpen: boolean
  
  //for Progress Tracking
  currentTime: number
  duration: number
  audioElement: HTMLAudioElement | null
  
  // Actions
  setQueue: (tracks: Track[]) => void
  playTrack: (track: Track) => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  playNext: () => void
  playPrev: () => void
  toggleOverlay: () => void
  
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setAudioElement: (el: HTMLAudioElement | null) => void
  seek: (time: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 1,
  isOverlayOpen: false,
  
  currentTime: 0,
  duration: 0,
  audioElement: null,

  setQueue: (tracks) => set({ queue: tracks }),
  
  playTrack: (track) => set({ currentTrack: track, isPlaying: true }),
  
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setVolume: (volume) => set({ volume }),
  
  playNext: () => {
    const { currentTrack, queue } = get()
    if (!currentTrack || queue.length === 0) return
    const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % queue.length
    set({ currentTrack: queue[nextIndex], isPlaying: true })
  },
  
  playPrev: () => {
    const { currentTrack, queue } = get()
    if (!currentTrack || queue.length === 0) return
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
    if (audioElement) {
      audioElement.currentTime = time
    }
    set({ currentTime: time })
  }
}))