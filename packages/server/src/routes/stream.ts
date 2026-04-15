/**
 * stream.ts
 *
 * Express router that streams audio files to the client.
 *
 * Route:
 *  GET /stream/:trackId
 *
 * How it works:
 *  1. Decodes the base64 trackId back to the original device file path.
 *  2. Checks the persistent cache directory (~/.musicbridge/cache/) for
 *     a pre-pulled copy of the file.
 *  3. If found in cache, serves it directly — no device needed.
 *  4. If not found, pulls the file from the connected Android device,
 *     saves it to cache, then serves it.
 *  5. Supports HTTP Range requests so the audio player can seek freely.
 *
 * Cache Strategy:
 *  Cache files are named `mb_stream_<trackId><ext>` inside CACHE_DIR.
 *  This naming convention is shared with adbService.ts, which pre-populates
 *  the cache during scanning. As a result, any track that has been scanned
 *  is immediately streamable offline — the phone does not need to be plugged in.
 *
 *  Cache lives in ~/.musicbridge/cache/ and survives reboots.
 */

import { Router, Request, Response } from 'express'
import Adb from '@devicefarmer/adbkit'
import * as fs from 'fs'
import * as path from 'path'
import { CACHE_DIR } from '../services/adbService'

const router = Router()
const client = Adb.createClient()

// ---------------------------------------------------------------------------
// MIME Type Map
// ---------------------------------------------------------------------------

/** Maps audio file extensions to their correct MIME types for the browser. */
const MIME_TYPES: Record<string, string> = {
  mp3:  'audio/mpeg',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  flac: 'audio/flac',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
}

// ---------------------------------------------------------------------------
// Device Helper
// ---------------------------------------------------------------------------

/**
 * Returns the ADB device ID of the first fully-authorised connected device.
 * Returns null if no device is available.
 */
async function getConnectedDeviceId(): Promise<string | null> {
  const devices = await client.listDevices()
  const device = devices.find((d: any) => d.type === 'device')
  return device ? device.id : null
}

// ---------------------------------------------------------------------------
// Stream Route
// ---------------------------------------------------------------------------

/**
 * GET /stream/:trackId
 *
 * Streams an audio file by track ID.
 *
 * @param trackId - Base64-encoded device file path (set as the track's `id`
 *                  during scanning in adbService.ts).
 *
 * Responses:
 *  200 - Full file stream
 *  206 - Partial content (range request for seeking)
 *  400 - Invalid track ID (bad base64)
 *  503 - Track not cached and no device connected
 *  500 - Unexpected stream error
 */
router.get('/:trackId', async (req: Request, res: Response) => {
  const trackId = req.params.trackId as string

  // Decode the base64 track ID back to the original file path on the device
  let remotePath: string
  try {
    remotePath = Buffer.from(trackId, 'base64').toString('utf8')
  } catch {
    res.status(400).json({ error: 'Invalid track ID' })
    return
  }

  const ext = path.extname(remotePath).replace('.', '').toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'audio/mpeg'

  // Persistent cache path — mirrors the filename adbService.ts writes during scan
  const cachedFile = path.join(CACHE_DIR, `mb_stream_${trackId}${path.extname(remotePath)}`)

  try {
    // ------------------------------------------------------------------
    // Step 1: Ensure the file is available locally
    // ------------------------------------------------------------------

    if (!fs.existsSync(cachedFile)) {
      // Not in cache — need to pull from the device
      const deviceId = await getConnectedDeviceId()
      if (!deviceId) {
        res.status(503).json({ error: 'No device connected and track not cached' })
        return
      }

      await client.getDevice(deviceId).pull(remotePath).then(
        (transfer: any) =>
          new Promise<void>((resolve, reject) => {
            transfer.on('end', resolve)
            transfer.on('error', reject)
            transfer.pipe(fs.createWriteStream(cachedFile))
          })
      )
    }

    // ------------------------------------------------------------------
    // Step 2: Serve the cached file, with Range support for seeking
    // ------------------------------------------------------------------

    const stat = fs.statSync(cachedFile)
    const fileSize = stat.size
    const rangeHeader = req.headers.range

    if (rangeHeader) {
      // Partial content — browser is seeking to a specific position
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   mimeType,
      })

      fs.createReadStream(cachedFile, { start, end }).pipe(res)
    } else {
      // Full file — initial load or format doesn't support ranges
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
      })

      fs.createReadStream(cachedFile).pipe(res)
    }
  } catch (err) {
    console.error('Stream error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream track' })
    }
  }
})

export default router