import Adb from '@devicefarmer/adbkit'
import { Server } from 'socket.io'
import * as mm from 'music-metadata'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Track } from '../types/Track'

const client = Adb.createClient()

const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.aac', '.wav', '.ogg', '.m4a']

// Folders to scan on the device
const SCAN_PATHS = [
  '/sdcard/Music',
  '/sdcard/Download',
  '/sdcard/DCIM',
  '/storage/emulated/0/Music',
  '/storage/emulated/0/Download',
]

async function getConnectedDeviceId(): Promise<string | null> {
  const devices = await client.listDevices()
  const device = devices.find((d: any) => d.type === 'device')
  return device ? device.id : null
}

async function findMusicFiles(deviceId: string): Promise<string[]> {
  const musicFiles: string[] = []

  for (const scanPath of SCAN_PATHS) {
    try {
      // Use adb shell find to locate music files in this path
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

async function pullAndReadMetadata(
  deviceId: string,
  remotePath: string
): Promise<Track | null> {
  try {
    const ext = path.extname(remotePath).toLowerCase()
    const tmpFile = path.join(os.tmpdir(), `mb_${Date.now()}_${path.basename(remotePath)}`)

    // Pull file from device to a temp location
    await client.getDevice(deviceId).pull(remotePath).then(
      (transfer: any) =>
        new Promise<void>((resolve, reject) => {
          transfer.on('end', resolve)
          transfer.on('error', reject)
          transfer.pipe(fs.createWriteStream(tmpFile))
        })
    )

    // Read metadata from the temp file
    const metadata = await mm.parseFile(tmpFile)
    const common = metadata.common
    const format = metadata.format

    // Extract album art if present
    let albumArtUrl: string | undefined
    if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0]
        albumArtUrl = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`
    }

    // Clean up the temp audio file (keep art files for now)
    fs.unlinkSync(tmpFile)

    const track: Track = {
      id: Buffer.from(remotePath).toString('base64'),
      title: common.title || path.basename(remotePath, ext),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: format.duration || 0,
      filePath: remotePath,
      albumArtUrl,
      format: ext.replace('.', ''),
    }

    return track
  } catch (err) {
    console.error(`Failed to read metadata for ${remotePath}:`, err)
    return null
  }
}

export async function scanMusicFiles(io: Server): Promise<void> {
  try {
    const deviceId = await getConnectedDeviceId()
    if (!deviceId) {
      console.log('No ADB device found for scanning')
      io.emit('scan:error', { message: 'No device connected' })
      return
    }

    console.log(`Scanning device ${deviceId} for music files...`)
    io.emit('scan:started')

    const filePaths = await findMusicFiles(deviceId)
    console.log(`Found ${filePaths.length} music files`)

    const tracks: Track[] = []

    for (const filePath of filePaths) {
      const track = await pullAndReadMetadata(deviceId, filePath)
      if (track) {
        tracks.push(track)
        // Emit each track as it's ready so the UI can update progressively
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