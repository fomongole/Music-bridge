import { useState, useEffect } from 'react'
import { RefreshCw, Search, ArrowUp } from 'lucide-react'
import { useSocket } from './hooks/useSocket'
import { usePlayerStore } from './store/usePlayerStore'

import { Header } from './components/layout/Header'
import { TrackList } from './components/library/TrackList'
import { PlayerBar } from './components/player/PlayerBar'
import { NowPlayingOverlay } from './components/player/NowPlayingOverlay'
import { AudioEngine } from './components/player/AudioEngine'

function App() {
  const { connected, deviceConnected, tracks, scanStatus, scanError, requestScan } = useSocket()
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  
  // Search and Scroll States
  const [searchQuery, setSearchQuery] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Track scrolling to toggle the FAB
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filter tracks based on search
  const filteredTracks = tracks.filter(track => 
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.album.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white transition-colors duration-300 ${currentTrack ? 'pb-32' : ''}`}>
      
      <AudioEngine />
      <NowPlayingOverlay />
      
      {/* Search state is now passed to the Header */}
      <Header 
        connected={connected} 
        deviceConnected={deviceConnected} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        hasTracks={tracks.length > 0}
      />

      <main className="max-w-5xl mx-auto w-full px-6 py-8 relative">
        
        {/* Title & Sync Button Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Your Library</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {tracks.length > 0 ? `${tracks.length} tracks found on device` : 'Connect your phone to sync music'}
            </p>
          </div>

          <button
            onClick={requestScan}
            disabled={!deviceConnected || scanStatus === 'scanning'}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-semibold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${scanStatus === 'scanning' ? 'animate-spin' : ''}`} />
            {scanStatus === 'scanning' ? 'Scanning...' : 'Sync Device'}
          </button>
        </div>

        {/* Error State */}
        {scanStatus === 'error' && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 mb-6">
            <p className="font-medium">Sync Error: {scanError}</p>
          </div>
        )}

        {/* Dynamic Lists */}
        {tracks.length === 0 && scanStatus !== 'scanning' ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">No music found</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Plug in your Android device via USB and click sync to bridge your local music library.
            </p>
          </div>
        ) : filteredTracks.length === 0 && tracks.length > 0 ? (
           <div className="text-center py-20 text-slate-500 font-medium">
             No tracks match "{searchQuery}"
           </div>
        ) : (
          <TrackList tracks={filteredTracks} />
        )}

      </main>

      {/* Scroll to Top FAB */}
      <button 
        onClick={scrollToTop}
        className={`fixed bottom-28 right-8 p-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl transition-all duration-300 z-30 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <PlayerBar />
    </div>
  )
}

export default App