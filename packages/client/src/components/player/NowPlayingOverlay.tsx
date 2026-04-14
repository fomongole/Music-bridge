import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, Shuffle, Repeat, Repeat1 } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useDominantColor } from '../../hooks/useDominantColor'

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function NowPlayingOverlay() {
  const { 
    currentTrack, 
    queue,
    isOverlayOpen, 
    toggleOverlay,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    volume,
    setVolume,
    currentTime,
    duration,
    seek,
    playTrack,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat
  } = usePlayerStore()

  const dominantColor = useDominantColor(currentTrack?.albumArtUrl)

  return (
    <AnimatePresence>
      {isOverlayOpen && currentTrack && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden"
        >
          {/* Dynamic Animated Background */}
          <motion.div 
            className="absolute inset-0 opacity-40 dark:opacity-20 blur-[120px] transition-colors duration-1000 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 50%, ${dominantColor} 0%, transparent 70%)` }}
          />

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between px-8 py-6 shrink-0">
            <button onClick={toggleOverlay} className="p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors backdrop-blur-md">
              <ChevronDown className="w-6 h-6 text-slate-800 dark:text-white" />
            </button>
            <span className="text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">Now Playing</span>
            <div className="w-10" />
          </div>

          {/* Main Content Area - 3 Column Layout on Desktop */}
          <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-10 lg:gap-16 px-8 max-w-[1800px] mx-auto w-full pb-10 min-h-0">
            
            {/* COLUMN 1: Album Art */}
            <div className="flex-1 w-full flex items-center justify-center lg:justify-end max-w-[500px]">
              <motion.div className="w-full aspect-square rounded-2xl shadow-2xl overflow-hidden bg-slate-200 dark:bg-zinc-800" layoutId="album-art">
                {currentTrack.albumArtUrl ? (
                  <img src={currentTrack.albumArtUrl} alt={currentTrack.album} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-6xl">♪</div>
                )}
              </motion.div>
            </div>

            {/* COLUMN 2: Meta, Progress & Controls */}
            <div className="flex-1 w-full flex flex-col justify-center items-center lg:items-start max-w-[450px]">
              
              <div className="text-center lg:text-left mb-8 w-full">
                <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white truncate mb-2">{currentTrack.title}</h2>
                <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-300 truncate">{currentTrack.artist}</p>
                <p className="text-sm text-slate-500 dark:text-slate-500 truncate mt-1">{currentTrack.album}</p>
              </div>

              {/* Real Progress Bar */}
              <div className="w-full mb-10">
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => seek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                />
                <div className="flex justify-between text-xs font-medium text-slate-500 mt-2">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Playback Controls (Perfectly Centered & Error Fixed) */}
              <div className="flex items-center justify-center gap-6 lg:gap-10 mb-10 w-full px-4 lg:px-0">
                
                <button onClick={toggleShuffle} className={`transition-colors ${isShuffle ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  <Shuffle className="w-5 h-5" />
                </button>
                
                <button onClick={playPrev} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0">
                  <SkipBack className="w-10 h-10 fill-current" />
                </button>
                
                <button onClick={togglePlay} className="w-24 h-24 flex items-center justify-center rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 transition-transform shadow-xl shrink-0">
                  {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-2" />}
                </button>
                
                <button onClick={() => playNext()} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0">
                  <SkipForward className="w-10 h-10 fill-current" />
                </button>

                <button onClick={toggleRepeat} className={`transition-colors ${repeatMode !== 'off' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>

              </div>

              {/* Volume */}
              <div className="w-full flex items-center gap-4 bg-slate-100 dark:bg-zinc-800/50 p-4 rounded-xl backdrop-blur-sm">
                <Volume2 className="w-5 h-5 text-slate-500 shrink-0" />
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white" />
              </div>
            </div>

            {/* COLUMN 3: Full Playing Queue */}
            {queue.length > 0 && (
              <div className="flex-1 w-full max-w-[450px] flex flex-col h-[50vh] lg:h-auto max-h-[700px] bg-white/40 dark:bg-black/20 rounded-3xl p-6 backdrop-blur-xl border border-white/20 shadow-lg">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-white/10 text-slate-800 dark:text-white shrink-0">
                  <ListMusic className="w-5 h-5" />
                  <h3 className="font-bold tracking-wide">Playing Queue</h3>
                  <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-200 dark:bg-zinc-800 px-2 py-1 rounded-full">
                    {queue.length} Tracks
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {queue.map((track, idx) => {
                    const isCurrentlyPlaying = currentTrack.id === track.id;

                    return (
                      <div 
                        key={track.id + idx}
                        onClick={() => playTrack(track)}
                        className={`group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${
                          isCurrentlyPlaying 
                            ? 'bg-indigo-500/10 dark:bg-indigo-500/20 shadow-sm ring-1 ring-indigo-500/30' 
                            : 'hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                      >
                        <div className="relative w-12 h-12 rounded bg-slate-200 dark:bg-zinc-800 overflow-hidden shrink-0 shadow-sm">
                          {track.albumArtUrl ? (
                            <img src={track.albumArtUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs">♪</div>
                          )}
                          
                          {/* Active Playing Indicator Overlay */}
                          {isCurrentlyPlaying && (
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                               {isPlaying ? (
                                 <div className="flex gap-0.5 items-end h-4">
                                   <div className="w-1 bg-white h-2 animate-bounce" style={{ animationDelay: '0ms' }} />
                                   <div className="w-1 bg-white h-4 animate-bounce" style={{ animationDelay: '150ms' }} />
                                   <div className="w-1 bg-white h-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                                 </div>
                               ) : (
                                 <Pause className="w-4 h-4 text-white fill-current" />
                               )}
                             </div>
                          )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold truncate ${isCurrentlyPlaying ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                            {track.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{track.artist}</p>
                        </div>
                        
                        <span className={`text-xs ${isCurrentlyPlaying ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-slate-500'}`}>
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}