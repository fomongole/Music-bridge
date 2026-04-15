import { create } from 'zustand'
import { SERVER_URL } from '../config'

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
}

interface PlaylistState {
  playlists: Playlist[]
  activePlaylistId: string | null   // null = "Your Library"
  isLoading: boolean

  // Actions
  fetchPlaylists: () => Promise<void>
  createPlaylist: (name: string) => Promise<Playlist | null>
  renamePlaylist: (id: string, name: string) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  setActivePlaylist: (id: string | null) => void
}

export const usePlaylistStore = create<PlaylistState>((set) => ({
  playlists: [],
  activePlaylistId: null,
  isLoading: false,

  fetchPlaylists: async () => {
    try {
      const res = await fetch(`${SERVER_URL}/playlists`)
      if (!res.ok) return
      const data: Playlist[] = await res.json()
      set({ playlists: data })
    } catch {
      // Server not ready — silently ignore on startup
    }
  },

  createPlaylist: async (name: string) => {
    const res = await fetch(`${SERVER_URL}/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return null
    const created: Playlist = await res.json()
    set(state => ({ playlists: [created, ...state.playlists] }))
    return created
  },

  renamePlaylist: async (id: string, name: string) => {
    const res = await fetch(`${SERVER_URL}/playlists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return
    const updated: Playlist = await res.json()
    set(state => ({
      playlists: state.playlists.map(p => p.id === id ? updated : p)
    }))
  },

  deletePlaylist: async (id: string) => {
    await fetch(`${SERVER_URL}/playlists/${id}`, { method: 'DELETE' })
    set(state => ({
      playlists: state.playlists.filter(p => p.id !== id),
      activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId,
    }))
  },

  addTrackToPlaylist: async (playlistId: string, trackId: string) => {
    const res = await fetch(`${SERVER_URL}/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId }),
    })
    if (!res.ok) return
    const updated: Playlist = await res.json()
    set(state => ({
      playlists: state.playlists.map(p => p.id === playlistId ? updated : p)
    }))
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    const res = await fetch(
      `${SERVER_URL}/playlists/${playlistId}/tracks/${trackId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) return
    const updated: Playlist = await res.json()
    set(state => ({
      playlists: state.playlists.map(p => p.id === playlistId ? updated : p)
    }))
  },

  setActivePlaylist: (id) => set({ activePlaylistId: id }),
}))