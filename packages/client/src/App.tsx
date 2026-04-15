import { useState, useEffect } from 'react'
import { RefreshCw, Search, ArrowUp, Music2 } from 'lucide-react'
import { useSocket } from './hooks/useSocket'
import { usePlayerStore } from './store/usePlayerStore'
import { usePlaylistStore } from './store/usePlaylistStore'
import { useAutoMixStore } from './store/useAutoMixStore'

import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { TrackList } from './components/library/TrackList'
import { PlayerBar } from './components/player/PlayerBar'
import { NowPlayingOverlay } from './components/player/NowPlayingOverlay'
import { AudioEngine } from './components/player/AudioEngine'
import { DJEngine } from './components/player/DJEngine'
import { PlaylistAutoMixPanel } from './components/player/PlaylistAutoMixPanel'

function App() {
  const { connected, deviceConnected, tracks, scanStatus, scanError, requestScan } = useSocket()
  const currentTrack = usePlayerStore(state => state.currentTrack)

  const {
    playlists,
    activePlaylistId,
    fetchPlaylists,
    removeTrackFromPlaylist,
    setActivePlaylist,
  } = usePlaylistStore()

  const { isEnabled: autoMixEnabled, setEnabled: setAutoMixEnabled } = useAutoMixStore()

  const [searchQuery, setSearchQuery]     = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Fetch playlists on mount
  useEffect(() => { fetchPlaylists() }, [fetchPlaylists])

  // Re-fetch playlists when the server reconnects (new scan etc.)
  useEffect(() => {
    if (connected) fetchPlaylists()
  }, [connected, fetchPlaylists])

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // ── Stop auto-mix when the user navigates away from a playlist ────────────
  // This covers: switching to another playlist, going back to the library,
  // or any other activePlaylistId change.
  useEffect(() => {
    if (useAutoMixStore.getState().isEnabled) {
      useAutoMixStore.getState().setEnabled(false)
      usePlayerStore.setState({ isPlaying: false })
    }
  }, [activePlaylistId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  // ── Determine what to display ─────────────────────────────────────────────
  const activePlaylist = playlists.find(p => p.id === activePlaylistId) ?? null

  const visibleTracks = activePlaylist
    ? tracks.filter(t => activePlaylist.trackIds.includes(t.id))
    : tracks

  const filteredTracks = visibleTracks.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.album.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRemoveFromPlaylist = async (trackId: string) => {
    if (!activePlaylistId) return
    // If auto-mix is running and we remove the active track, stop the mix
    if (autoMixEnabled) {
      setAutoMixEnabled(false)
      usePlayerStore.setState({ isPlaying: false })
    }
    await removeTrackFromPlaylist(activePlaylistId, trackId)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`
        min-h-screen flex flex-col
        bg-slate-50 dark:bg-zinc-950
        text-slate-900 dark:text-white
        transition-colors duration-300
        ${currentTrack ? 'pb-32' : ''}
      `}
    >
      <AudioEngine />
      <DJEngine />
      <NowPlayingOverlay />

      <Header
        connected={connected}
        deviceConnected={deviceConnected}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        hasTracks={tracks.length > 0}
      />

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full px-6 py-8 relative">

            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
              <div>
                {activePlaylist ? (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-500 mb-1 uppercase tracking-widest">
                      <Music2 className="w-3 h-3" />
                      Playlist
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight">{activePlaylist.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      {activePlaylist.trackIds.length}{' '}
                      {activePlaylist.trackIds.length === 1 ? 'track' : 'tracks'}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-extrabold tracking-tight">Your Library</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      {tracks.length > 0
                        ? `${tracks.length} tracks found on device`
                        : 'Connect your phone to sync music'}
                    </p>
                  </>
                )}
              </div>

              {/* Right side: Auto Mix for playlists | Sync for library */}
              {activePlaylist ? (
                /* Only show Auto Mix when the playlist has tracks */
                activePlaylist.trackIds.length > 0 && (
                  <PlaylistAutoMixPanel tracks={filteredTracks.length > 0 ? filteredTracks : visibleTracks} />
                )
              ) : (
                <button
                  onClick={requestScan}
                  disabled={!deviceConnected || scanStatus === 'scanning'}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-semibold transition-all shadow-md shadow-indigo-600/20 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${scanStatus === 'scanning' ? 'animate-spin' : ''}`} />
                  {scanStatus === 'scanning' ? 'Scanning...' : 'Sync Device'}
                </button>
              )}
            </div>

            {/* Scan error (library view only) */}
            {scanStatus === 'error' && !activePlaylist && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 mb-6">
                <p className="font-medium">Sync Error: {scanError}</p>
              </div>
            )}

            {/* Empty playlist */}
            {activePlaylist && activePlaylist.trackIds.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                  <Music2 className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">Playlist is empty</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  Hover any track in{' '}
                  <button
                    className="text-indigo-500 font-semibold"
                    onClick={() => setActivePlaylist(null)}
                  >
                    Your Library
                  </button>{' '}
                  and click <span className="font-semibold text-indigo-500">+</span> to add songs here.
                </p>
              </div>
            )}

            {/* No library tracks */}
            {!activePlaylist && tracks.length === 0 && scanStatus !== 'scanning' && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No music found</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Plug in your Android device via USB and click sync to bridge your local music library.
                </p>
              </div>
            )}

            {/* No search results */}
            {filteredTracks.length === 0 && visibleTracks.length > 0 && (
              <div className="text-center py-20 text-slate-500 font-medium">
                No tracks match "{searchQuery}"
              </div>
            )}

            {/* Track list */}
            {filteredTracks.length > 0 && (
              <TrackList
                tracks={filteredTracks}
                playlistId={activePlaylistId ?? undefined}
                onRemoveFromPlaylist={activePlaylist ? handleRemoveFromPlaylist : undefined}
              />
            )}

          </div>
        </main>
      </div>

      {/* Scroll-to-top FAB */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-28 right-8 p-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl transition-all duration-300 z-30 ${
          showScrollTop
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <PlayerBar />
    </div>
  )
}

export default App