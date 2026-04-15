/**
 * playlistService.ts
 *
 * Handles all playlist CRUD operations.
 * Playlists are stored in ~/.musicbridge/playlists.json — simple,
 * persistent, and survives reboots just like the audio cache.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Playlist {
  id: string
  name: string
  trackIds: string[]   // base64-encoded track IDs (same as Track.id)
  createdAt: number    // Unix timestamp ms
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const MUSIC_BRIDGE_DIR = path.join(os.homedir(), '.musicbridge')
const PLAYLISTS_FILE   = path.join(MUSIC_BRIDGE_DIR, 'playlists.json')

// Ensure the directory exists (it will already exist if the cache is set up,
// but we guard here so this service can work independently)
if (!fs.existsSync(MUSIC_BRIDGE_DIR)) {
  fs.mkdirSync(MUSIC_BRIDGE_DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPlaylists(): Playlist[] {
  if (!fs.existsSync(PLAYLISTS_FILE)) return []
  try {
    const raw = fs.readFileSync(PLAYLISTS_FILE, 'utf8')
    return JSON.parse(raw) as Playlist[]
  } catch {
    return []
  }
}

function writePlaylists(playlists: Playlist[]): void {
  fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlists, null, 2), 'utf8')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns all playlists, sorted newest first. */
export function getAllPlaylists(): Playlist[] {
  return readPlaylists().sort((a, b) => b.createdAt - a.createdAt)
}

/** Creates a new empty playlist with the given name. */
export function createPlaylist(name: string): Playlist {
  const playlists = readPlaylists()
  const playlist: Playlist = {
    id:        randomUUID(),
    name:      name.trim(),
    trackIds:  [],
    createdAt: Date.now(),
  }
  playlists.push(playlist)
  writePlaylists(playlists)
  return playlist
}

/** Renames a playlist or replaces its track list (partial update). */
export function updatePlaylist(
  id: string,
  patch: Partial<Pick<Playlist, 'name' | 'trackIds'>>
): Playlist | null {
  const playlists = readPlaylists()
  const idx = playlists.findIndex(p => p.id === id)
  if (idx === -1) return null

  if (patch.name    !== undefined) playlists[idx].name     = patch.name.trim()
  if (patch.trackIds !== undefined) playlists[idx].trackIds = patch.trackIds

  writePlaylists(playlists)
  return playlists[idx]
}

/** Adds a single track ID to a playlist (idempotent — no duplicates). */
export function addTrackToPlaylist(playlistId: string, trackId: string): Playlist | null {
  const playlists = readPlaylists()
  const playlist  = playlists.find(p => p.id === playlistId)
  if (!playlist) return null

  if (!playlist.trackIds.includes(trackId)) {
    playlist.trackIds.push(trackId)
    writePlaylists(playlists)
  }
  return playlist
}

/** Removes a single track ID from a playlist. */
export function removeTrackFromPlaylist(playlistId: string, trackId: string): Playlist | null {
  const playlists = readPlaylists()
  const playlist  = playlists.find(p => p.id === playlistId)
  if (!playlist) return null

  playlist.trackIds = playlist.trackIds.filter(id => id !== trackId)
  writePlaylists(playlists)
  return playlist
}

/** Permanently deletes a playlist. */
export function deletePlaylist(id: string): boolean {
  const playlists = readPlaylists()
  const filtered  = playlists.filter(p => p.id !== id)
  if (filtered.length === playlists.length) return false
  writePlaylists(filtered)
  return true
}