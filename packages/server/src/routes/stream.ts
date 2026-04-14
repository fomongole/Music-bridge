import { Router, Request, Response } from 'express'
import Adb from '@devicefarmer/adbkit'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const router = Router()
const client = Adb.createClient()

const MIME_TYPES: Record<string, string> = {
  mp3:  'audio/mpeg',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  flac: 'audio/flac',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
}

async function getConnectedDeviceId(): Promise<string | null> {
  const devices = await client.listDevices()
  const device = devices.find((d: any) => d.type === 'device')
  return device ? device.id : null
}

router.get('/:trackId', async (req: Request, res: Response) => {
  // Explicitly cast to string — Express types params as string | string[]
  const trackId = req.params.trackId as string

  // Decode the base64 track ID back to the file path on the device
  let remotePath: string
  try {
    remotePath = Buffer.from(trackId, 'base64').toString('utf8')
  } catch {
    res.status(400).json({ error: 'Invalid track ID' })
    return
  }

  const ext = path.extname(remotePath).replace('.', '').toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'audio/mpeg'
  const tmpFile = path.join(os.tmpdir(), `mb_stream_${trackId}${path.extname(remotePath)}`)

  try {
    // Check tmp cache first — if already pulled, serve directly without needing the phone
    if (!fs.existsSync(tmpFile)) {
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
            transfer.pipe(fs.createWriteStream(tmpFile))
          })
      )
    }

    const stat = fs.statSync(tmpFile)
    const fileSize = stat.size
    const rangeHeader = req.headers.range

    if (rangeHeader) {
      // Handle range request — essential for seeking in the audio player
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

      fs.createReadStream(tmpFile, { start, end }).pipe(res)
    } else {
      // No range — send the whole file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
      })

      fs.createReadStream(tmpFile).pipe(res)
    }
  } catch (err) {
    console.error('Stream error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream track' })
    }
  }
})

export default router