import { useEffect, useRef, useState } from 'react'
import { Plus, ListMusic, Check, PlusCircle } from 'lucide-react'
import { usePlaylistStore } from '../../store/usePlaylistStore'

interface Props {
  trackId: string
}

export function AddToPlaylistMenu({ trackId }: Props) {
  const { playlists, addTrackToPlaylist, removeTrackFromPlaylist, createPlaylist } = usePlaylistStore()

  const [open, setOpen]           = useState(false)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(v => !v)
    setCreating(false)
    setNewName('')
  }

  const handleToggleTrack = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist) return
    if (playlist.trackIds.includes(trackId)) {
      await removeTrackFromPlaylist(playlistId, trackId)
    } else {
      await addTrackToPlaylist(playlistId, trackId)
    }
  }

  const handleCreateAndAdd = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (!newName.trim()) return
    const created = await createPlaylist(newName.trim())
    if (created) await addTrackToPlaylist(created.id, trackId)
    setCreating(false)
    setNewName('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggle}
        className="
          w-7 h-7 flex items-center justify-center rounded-full
          bg-slate-100 dark:bg-zinc-800
          text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400
          hover:bg-indigo-50 dark:hover:bg-indigo-500/10
          transition-colors shadow-sm
        "
        title="Add to playlist"
      >
        <Plus className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="
            absolute right-0 bottom-9 z-50
            w-52 bg-white dark:bg-zinc-800 rounded-2xl
            shadow-2xl border border-slate-200 dark:border-white/10
            py-2 overflow-hidden
          "
          onMouseDown={e => e.stopPropagation()}
        >
          <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Add to playlist
          </p>

          {/* Existing playlists */}
          <div className="max-h-48 overflow-y-auto">
            {playlists.length === 0 && !creating && (
              <p className="px-4 py-3 text-xs text-slate-400 text-center">No playlists yet</p>
            )}
            {playlists.map(p => {
              const isIn = p.trackIds.includes(trackId)
              return (
                <button
                  key={p.id}
                  onClick={e => handleToggleTrack(e, p.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${isIn
                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}
                  `}
                >
                  <ListMusic className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{p.name}</span>
                  {isIn && <Check className="w-4 h-4 shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-slate-100 dark:border-white/5" />

          {/* Create new playlist */}
          {creating ? (
            <div className="px-3 py-2 flex items-center gap-2">
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  handleCreateAndAdd(e)
                  if (e.key === 'Escape') { setCreating(false); setNewName('') }
                }}
                onClick={e => e.stopPropagation()}
                placeholder="Playlist name…"
                className="flex-1 min-w-0 bg-slate-100 dark:bg-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button
                onClick={handleCreateAndAdd}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shrink-0"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setCreating(true) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors font-medium"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              New playlist
            </button>
          )}
        </div>
      )}
    </div>
  )
}