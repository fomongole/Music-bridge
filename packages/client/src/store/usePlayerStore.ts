import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
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

export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector((set, get) => ({
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
      const { isShuffle, queue } = get()
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

      if (autoEnded && repeatMode === 'one') {
        seek(0)
        const { audioElement } = get()
        if (audioElement) audioElement.play().catch(console.error)
        return
      }

      const currentIndex = queue.findIndex(t => t.id === currentTrack.id)
      const isLastTrack = currentIndex === queue.length - 1

      if (autoEnded && isLastTrack && repeatMode === 'off') {
        set({ isPlaying: false })
        seek(0)
        return
      }

      const nextIndex = (currentIndex + 1) % queue.length
      set({ currentTrack: queue[nextIndex], isPlaying: true })
    },

    playPrev: () => {
      const { currentTrack, queue, currentTime, seek } = get()
      if (!currentTrack || queue.length === 0) return

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
        const remaining = [...originalQueue].filter(t => t.id !== currentTrack?.id)
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]]
        }
        set({ isShuffle: true, queue: currentTrack ? [currentTrack, ...remaining] : remaining })
      } else {
        set({ isShuffle: false, queue: originalQueue })
      }
    },

    toggleRepeat: () => {
      const { repeatMode } = get()
      const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
      set({ repeatMode: nextMode })
    },
  }))
)