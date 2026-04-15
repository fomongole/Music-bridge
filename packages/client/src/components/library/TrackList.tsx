import { Play, Trash2 } from 'lucide-react'
import type { Track } from '../../types/Track'
import { usePlayerStore } from '../../store/usePlayerStore'
import { AddToPlaylistMenu } from './AddToPlaylistMenu'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  tracks: Track[]
  /** If provided, show a remove-from-playlist button instead of the add button */
  playlistId?: string
  onRemoveFromPlaylist?: (trackId: string) => void
}

export function TrackList({ tracks, playlistId, onRemoveFromPlaylist }: Props) {
  const { currentTrack, playTrack, setQueue } = usePlayerStore()

  const handlePlay = (track: Track) => {
    setQueue(tracks)
    playTrack(track)
  }

  if (tracks.length === 0) return null

  return (
    <div className="w-full space-y-1 mt-6">
      {tracks.map((track) => {
        const isSelected = currentTrack?.id === track.id

        return (
          <div
            key={track.id}
            onClick={() => handlePlay(track)}
            className={`
              group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200
              ${isSelected
                ? 'bg-indigo-50 dark:bg-indigo-500/10'
                : 'hover:bg-slate-100 dark:hover:bg-white/5'}
            `}
          >
            {/* Album Art */}
            <div className="relative w-12 h-12 rounded-md bg-slate-200 dark:bg-zinc-800 shrink-0 overflow-hidden shadow-sm">
              {track.albumArtUrl ? (
                <img src={track.albumArtUrl} alt={track.album} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">♪</div>
              )}
              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {isSelected ? (
                  <div className="flex gap-0.5 items-end h-4">
                    <div className="w-1 bg-indigo-400 h-2 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 bg-indigo-400 h-4 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 bg-indigo-400 h-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <Play className="w-5 h-5 text-white fill-current" />
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate transition-colors ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                {track.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {track.artist} <span className="mx-1 opacity-50">•</span> {track.album}
              </p>
            </div>

            {/* Badges, Duration, and Action */}
            <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-slate-400">
                {track.format}
              </span>
              <span className="text-sm font-medium text-slate-500 w-12 text-right">
                {formatDuration(track.duration)}
              </span>

              {/* Action button: remove (in playlist view) or add to playlist */}
              {playlistId && onRemoveFromPlaylist ? (
                <button
                  onClick={() => onRemoveFromPlaylist(track.id)}
                  className="
                    opacity-0 group-hover:opacity-100
                    w-7 h-7 flex items-center justify-center rounded-full
                    text-slate-400 hover:text-rose-500
                    hover:bg-rose-50 dark:hover:bg-rose-500/10
                    transition-all
                  "
                  title="Remove from playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <AddToPlaylistMenu trackId={track.id} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}