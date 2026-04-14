import { useRef, useState, useEffect } from 'react'
import { useSocket } from './hooks/useSocket'
import type { Track } from './types/Track'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TrackRow({
  track,
  isPlaying,
  isSelected,
  onClick,
}: {
  track: Track
  isPlaying: boolean
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-white/10' : 'hover:bg-white/5'
      }`}
    >
      <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden relative">
        {track.albumArtUrl ? (
          <img src={track.albumArtUrl} alt={track.album} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-500 text-xs">♪</span>
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs">{isPlaying ? '▶' : '⏸'}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-400' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-xs text-gray-400 truncate">{track.artist} · {track.album}</p>
      </div>
      <div className="text-xs text-gray-500 shrink-0">{formatDuration(track.duration)}</div>
      <div className="text-xs text-gray-600 uppercase shrink-0">{track.format}</div>
    </div>
  )
}

function Player({
  track,
  onNext,
  onPrev,
}: {
  track: Track
  onNext: () => void
  onPrev: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(track.duration)
  const [volume, setVolume] = useState(1)

  // When track changes, load and autoplay
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `http://localhost:3001/stream/${track.id}`
    audio.load()
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    setCurrentTime(0)
    setDuration(track.duration)
  }, [track.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true))
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const time = parseFloat(e.target.value)
    audio.currentTime = time
    setCurrentTime(time)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-white/10 px-6 py-3">
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || track.duration)}
        onEnded={onNext}
      />

      <div className="max-w-3xl mx-auto flex flex-col gap-2">

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-10 text-right">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 accent-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-gray-500 w-10">{formatDuration(duration)}</span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-4">

          {/* Album art + track info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded bg-gray-800 shrink-0 overflow-hidden">
              {track.albumArtUrl ? (
                <img src={track.albumArtUrl} alt={track.album} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-500 text-xs">♪</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{track.title}</p>
              <p className="text-xs text-gray-400 truncate">{track.artist}</p>
            </div>
          </div>

          {/* Playback buttons */}
          <div className="flex items-center gap-4 shrink-0">
            <button onClick={onPrev} className="text-gray-400 hover:text-white transition-colors text-lg">
              ⏮
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors text-sm"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={onNext} className="text-gray-400 hover:text-white transition-colors text-lg">
              ⏭
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-gray-500 text-sm">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 h-1 accent-indigo-500 cursor-pointer"
            />
          </div>

        </div>
      </div>
    </div>
  )
}

function App() {
  const { connected, deviceConnected, tracks, scanStatus, scanError, requestScan } = useSocket()
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)

  const selectedIndex = selectedTrack ? tracks.findIndex(t => t.id === selectedTrack.id) : -1

  const playNext = () => {
    if (tracks.length === 0) return
    const nextIndex = (selectedIndex + 1) % tracks.length
    setSelectedTrack(tracks[nextIndex])
  }

  const playPrev = () => {
    if (tracks.length === 0) return
    const prevIndex = (selectedIndex - 1 + tracks.length) % tracks.length
    setSelectedTrack(tracks[prevIndex])
  }

  return (
    <div className={`min-h-screen bg-gray-950 text-white flex flex-col ${selectedTrack ? 'pb-28' : ''}`}>

      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">MusicBridge</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">{connected ? 'Server' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${deviceConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-400">{deviceConnected ? 'Phone connected' : 'No device'}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full">

        {/* Scan button + status */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={requestScan}
            disabled={!deviceConnected || scanStatus === 'scanning'}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {scanStatus === 'scanning' ? 'Scanning...' : 'Scan Music'}
          </button>

          {scanStatus === 'scanning' && (
            <span className="text-sm text-gray-400">Found {tracks.length} tracks so far...</span>
          )}
          {scanStatus === 'complete' && (
            <span className="text-sm text-green-400">✓ {tracks.length} tracks found</span>
          )}
          {scanStatus === 'error' && (
            <span className="text-sm text-red-400">✗ {scanError}</span>
          )}
        </div>

        {/* Track list */}
        {tracks.length > 0 && (
          <div className="space-y-1">
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isSelected={selectedTrack?.id === track.id}
                isPlaying={selectedTrack?.id === track.id}
                onClick={() => setSelectedTrack(track)}
              />
            ))}
          </div>
        )}

        {scanStatus === 'idle' && tracks.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-20">
            Connect your Android phone and press Scan Music
          </p>
        )}

      </main>

      {/* Player */}
      {selectedTrack && (
        <Player
          track={selectedTrack}
          onNext={playNext}
          onPrev={playPrev}
        />
      )}

    </div>
  )
}

export default App