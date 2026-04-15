/**
 * adbService.ts
 *
 * Handles all ADB (Android Debug Bridge) communication with the connected device.
 *
 * Responsibilities:
 *  - Discovering music files across common Android storage paths
 *  - Pulling audio files from the device and caching them locally
 *  - Extracting track metadata (title, artist, album art, duration, etc.)
 *  - Emitting real-time scan progress events via Socket.io
 *  - Serving cached tracks so the app works even after the phone is unplugged
 *
 * Cache Strategy:
 *  Audio files are pulled once and stored in ~/.musicbridge/cache/ using a
 *  filename derived from the track's base64 ID — the same name the stream
 *  route looks for. This means:
 *    1. Every scanned track is immediately playable offline.
 *    2. The stream route never has to re-pull a file it already has.
 *    3. Cache survives app restarts and OS reboots.
 *    4. Re-scanning skips files that are already cached.
 */

import Adb from '@devicefarmer/adbkit'
import { Server } from 'socket.io'
import * as mm from 'music-metadata'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Track } from '../types/Track'

// ---------------------------------------------------------------------------
// Cache Directory
// ---------------------------------------------------------------------------

/**
 * Persistent directory for cached audio files.
 * Lives in the user's home folder so it survives reboots.
 * Created automatically on first run if it doesn't exist.
 */
export const CACHE_DIR = path.join(os.homedir(), '.musicbridge', 'cache')

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  console.log(`Cache directory created at: ${CACHE_DIR}`)
}

// ---------------------------------------------------------------------------
// ADB Client
// ---------------------------------------------------------------------------

const client = Adb.createClient()

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Audio file extensions to look for on the device. */
const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.aac', '.wav', '.ogg', '.m4a']

/** Common Android paths where music files are typically stored. */
const SCAN_PATHS = [
  '/sdcard/Music',
  '/sdcard/Download',
  '/sdcard/DCIM',
  '/storage/emulated/0/Music',
  '/storage/emulated/0/Download',
]

// ---------------------------------------------------------------------------
// In-Memory Track Cache
// ---------------------------------------------------------------------------

/**
 * Holds the last successful scan result in memory.
 * Survives page refreshes within the same server session.
 * On a fresh server start, tracks are re-hydrated from the /tracks endpoint
 * which reads this value — so the client should fetch /tracks on mount.
 */
let trackCache: Track[] = []

export function getCachedTracks(): Track[] {
  return trackCache
}

// ---------------------------------------------------------------------------
// Device Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ADB device ID of the first fully-authorised connected device.
 * Returns null if no device is connected or none are in 'device' state.
 */
async function getConnectedDeviceId(): Promise<string | null> {
  const devices = await client.listDevices()
  const device = devices.find((d: any) => d.type === 'device')
  return device ? device.id : null
}

/**
 * Searches the device's common storage paths for audio files.
 * Uses a shell `find` command with case-insensitive extension matching.
 * Paths that don't exist on the device are skipped silently.
 */
async function findMusicFiles(deviceId: string): Promise<string[]> {
  const musicFiles: string[] = []

  for (const scanPath of SCAN_PATHS) {
    try {
      const output = await client
        .getDevice(deviceId)
        .shell(`find "${scanPath}" -type f \\( ${
          MUSIC_EXTENSIONS.map(ext => `-iname "*${ext}"`).join(' -o ')
        } \\) 2>/dev/null`)

      const result = await Adb.util.readAll(output)
      const lines = result.toString().trim().split('\n').filter(Boolean)
      musicFiles.push(...lines)
    } catch {
      // Path may not exist on this device — skip silently
    }
  }

  return musicFiles
}

// ---------------------------------------------------------------------------
// Metadata Extraction
// ---------------------------------------------------------------------------

/**
 * Pulls a single audio file from the device (if not already cached),
 * reads its ID3/metadata tags, and returns a Track object.
 *
 * Cache behaviour:
 *  - The file is saved to CACHE_DIR as `mb_stream_<trackId><ext>`.
 *  - This matches exactly what stream.ts looks for, so the stream route
 *    will serve it from cache without touching the device again.
 *  - If the file already exists in cache (e.g. from a previous scan),
 *    the pull is skipped entirely — making re-scans much faster.
 *
 * Returns null if the pull or metadata read fails for any reason.
 */
async function pullAndReadMetadata(
  deviceId: string,
  remotePath: string
): Promise<Track | null> {
  try {
    const ext = path.extname(remotePath).toLowerCase()

    // Derive the track ID the same way the stream route does so the
    // cached filename is predictable and shared between both services.
    const trackId = Buffer.from(remotePath).toString('base64')

    // Persistent cache path — shared with stream.ts
    const cachedFile = path.join(CACHE_DIR, `mb_stream_${trackId}${ext}`)

    // Only pull from the device if we don't already have this file
    if (!fs.existsSync(cachedFile)) {
      await client.getDevice(deviceId).pull(remotePath).then(
        (transfer: any) =>
          new Promise<void>((resolve, reject) => {
            transfer.on('end', resolve)
            transfer.on('error', reject)
            transfer.pipe(fs.createWriteStream(cachedFile))
          })
      )
    }

    const metadata = await mm.parseFile(cachedFile)
    const common = metadata.common
    const format = metadata.format

    // Embed album art as a base64 data URL so the client can display it
    // without a separate HTTP request.
    let albumArtUrl: string | undefined
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      albumArtUrl = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`
    }

    // Note: we intentionally do NOT delete cachedFile here.
    // It stays on disk so the stream route can serve it offline.

    return {
      id: trackId,
      title: common.title || path.basename(remotePath, ext),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: format.duration || 0,
      filePath: remotePath,
      albumArtUrl,
      format: ext.replace('.', ''),
    }
  } catch (err) {
    console.error(`Failed to read metadata for ${remotePath}:`, err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Public Scan Entry Point
// ---------------------------------------------------------------------------

/**
 * Orchestrates a full device scan:
 *  1. Finds all music files across SCAN_PATHS.
 *  2. Pulls and caches each file (skipping already-cached ones).
 *  3. Extracts metadata and emits each track to connected clients in real time.
 *  4. Updates the in-memory trackCache for the /tracks REST endpoint.
 *
 * Emits the following Socket.io events:
 *  - scan:started   — scan has begun, client should clear its list
 *  - track:found    — emitted per track as it's processed
 *  - scan:complete  — scan finished, includes total track count
 *  - scan:error     — something went wrong, includes a message
 */
export async function scanMusicFiles(io: Server): Promise<void> {
  try {
    const deviceId = await getConnectedDeviceId()
    if (!deviceId) {
      console.log('No ADB device found for scanning')
      io.emit('scan:error', { message: 'No device connected' })
      return
    }

    console.log(`Scanning device ${deviceId} for music files...`)
    trackCache = []
    io.emit('scan:started')

    const filePaths = await findMusicFiles(deviceId)
    console.log(`Found ${filePaths.length} music files`)

    const tracks: Track[] = []

    for (const filePath of filePaths) {
      const track = await pullAndReadMetadata(deviceId, filePath)
      if (track) {
        tracks.push(track)
        trackCache.push(track)
        io.emit('track:found', track)
      }
    }

    io.emit('scan:complete', { total: tracks.length })
    console.log(`Scan complete. ${tracks.length} tracks processed.`)
  } catch (err) {
    console.error('Scan failed:', err)
    io.emit('scan:error', { message: 'Scan failed on server' })
  }
}