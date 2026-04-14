import { useSocket } from './hooks/useSocket'
import type { Track } from './types/Track'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TrackRow({ track }: { track: Track }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
      <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
        {track.albumArtUrl ? (
          <img src={track.albumArtUrl} alt={track.album} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-500 text-xs">♪</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        <p className="text-xs text-gray-400 truncate">{track.artist} · {track.album}</p>
      </div>
      <div className="text-xs text-gray-500 shrink-0">{formatDuration(track.duration)}</div>
      <div className="text-xs text-gray-600 uppercase shrink-0">{track.format}</div>
    </div>
  )
}

function App() {
  const { connected, deviceConnected, tracks, scanStatus, scanError, requestScan } = useSocket()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

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
              <TrackRow key={track.id} track={track} />
            ))}
          </div>
        )}

        {scanStatus === 'idle' && tracks.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-20">
            Connect your Android phone and press Scan Music
          </p>
        )}

      </main>
    </div>
  )
}

export default App