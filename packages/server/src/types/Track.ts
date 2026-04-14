export interface Track {
  id: string           // unique hash or file path used as key
  title: string
  artist: string
  album: string
  duration: number     // seconds
  filePath: string     // absolute path on device or temp path on server
  albumArtUrl?: string // served via HTTP once we extract it
  format: string       // 'mp3' | 'flac' | 'aac' | 'wav' | 'ogg'
}