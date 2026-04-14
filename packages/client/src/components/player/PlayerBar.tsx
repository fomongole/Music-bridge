import { Play, Pause, SkipForward, SkipBack, Volume2, Maximize2 } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useDominantColor } from '../../hooks/useDominantColor'

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlay, 
    playNext, 
    playPrev, 
    volume, 
    setVolume,
    toggleOverlay,
    currentTime,
    duration,
    seek
  } = usePlayerStore()

  // We extract the color even down here to give the player bar a subtle glow!
  const dominantColor = useDominantColor(currentTrack?.albumArtUrl)

  if (!currentTrack) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-6 py-4 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 transition-colors">
      {/* Subtle background glow based on album art */}
      <div 
        className="absolute inset-0 opacity-10 dark:opacity-20 transition-colors duration-1000 ease-in-out pointer-events-none"
        style={{ backgroundColor: dominantColor }}
      />
      
      <div className="relative max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* 1. Track Info (Click to expand overlay) */}
        <div 
          className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer group"
          onClick={toggleOverlay}
        >
          <div className="relative w-14 h-14 rounded-md overflow-hidden shadow-md bg-slate-200 dark:bg-zinc-800 shrink-0 group-hover:scale-105 transition-transform">
            {currentTrack.albumArtUrl ? (
              <img src={currentTrack.albumArtUrl} alt={currentTrack.album} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">♪</div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {currentTrack.title}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* 2. Playback Controls */}
        <div className="flex flex-col items-center gap-2 flex-[2]">
          <div className="flex items-center gap-6">
            <button onClick={playPrev} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 transition-transform shadow-md"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
            <button onClick={playNext} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          
          {/* Real Progress Bar */}
          <div className="w-full max-w-md flex items-center gap-3">
             <span className="text-[10px] font-medium text-slate-500 w-8 text-right">{formatDuration(currentTime)}</span>
             <input
                type="range"
                min={0}
                max={duration || currentTrack.duration || 1}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
             />
             <span className="text-[10px] font-medium text-slate-500 w-8">{formatDuration(duration || currentTrack.duration)}</span>
          </div>
        </div>

        {/* 3. Volume & Tools */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <Volume2 className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
          />
        </div>

      </div>
    </div>
  )
}