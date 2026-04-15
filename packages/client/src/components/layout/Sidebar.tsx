import { useState, useRef, useEffect } from 'react'
import { Library, ListMusic, Plus, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { usePlaylistStore } from '../../store/usePlaylistStore'

export function Sidebar() {
  const { playlists, activePlaylistId, setActivePlaylist, createPlaylist, renamePlaylist, deletePlaylist } = usePlaylistStore()

  const [isCollapsed, setIsCollapsed]   = useState(false)
  const [isCreating, setIsCreating]     = useState(false)
  const [newName, setNewName]           = useState('')
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameValue, setRenameValue]   = useState('')
  const [menuOpenId, setMenuOpenId]     = useState<string | null>(null)

  const newNameRef    = useRef<HTMLInputElement>(null)
  const renameRef     = useRef<HTMLInputElement>(null)

  // Auto-focus when entering create/rename mode
  useEffect(() => { if (isCreating)  newNameRef.current?.focus()  }, [isCreating])
  useEffect(() => { if (renamingId)  renameRef.current?.focus()   }, [renamingId])

  // Close context menus on outside click
  useEffect(() => {
    const handler = () => setMenuOpenId(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreateSubmit = async () => {
    if (!newName.trim()) { setIsCreating(false); return }
    const created = await createPlaylist(newName.trim())
    setIsCreating(false)
    setNewName('')
    if (created) setActivePlaylist(created.id)
  }

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) await renamePlaylist(id, renameValue.trim())
    setRenamingId(null)
  }

  const startRename = (id: string, currentName: string) => {
    setMenuOpenId(null)
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const handleDelete = async (id: string) => {
    setMenuOpenId(null)
    await deletePlaylist(id)
  }

  return (
    <aside
      className={`
        relative shrink-0 flex flex-col
        bg-white dark:bg-zinc-900
        border-r border-slate-200 dark:border-white/5
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-[60px]' : 'w-[260px]'}
      `}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(v => !v)}
        className="
          absolute -right-3 top-6 z-10
          w-6 h-6 rounded-full
          bg-white dark:bg-zinc-800
          border border-slate-200 dark:border-white/10
          flex items-center justify-center
          shadow-sm hover:shadow-md transition-shadow
          text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white
        "
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <div className="flex flex-col flex-1 overflow-hidden py-4">

        {/* ── Your Library ─────────────────────────────────────── */}
        <button
          onClick={() => setActivePlaylist(null)}
          className={`
            flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 mb-1
            transition-colors text-left
            ${activePlaylistId === null
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}
          `}
        >
          <Library className="w-5 h-5 shrink-0" />
          {!isCollapsed && (
            <span className="text-sm font-semibold truncate">Your Library</span>
          )}
        </button>

        {/* ── Playlists Header ─────────────────────────────────── */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-4 mt-4 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Playlists
            </span>
            <button
              onClick={() => setIsCreating(true)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title="New playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Collapsed: show a centered + icon */}
        {isCollapsed && (
          <button
            onClick={() => { setIsCollapsed(false); setIsCreating(true) }}
            className="flex items-center justify-center mt-4 mx-2 py-2 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="New playlist"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* ── New Playlist Input ───────────────────────────────── */}
        {isCreating && !isCollapsed && (
          <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-indigo-500 shrink-0" />
            <input
              ref={newNameRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  handleCreateSubmit()
                if (e.key === 'Escape') { setIsCreating(false); setNewName('') }
              }}
              onBlur={handleCreateSubmit}
              placeholder="Playlist name…"
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none min-w-0"
            />
            <button onClick={handleCreateSubmit} className="text-indigo-500 hover:text-indigo-700 shrink-0">
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Playlist List ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-0.5 px-2">
          {playlists.map(playlist => (
            <div key={playlist.id} className="relative group">

              {/* Rename inline */}
              {renamingId === playlist.id && !isCollapsed ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                  <ListMusic className="w-4 h-4 text-indigo-500 shrink-0" />
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  handleRenameSubmit(playlist.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => handleRenameSubmit(playlist.id)}
                    className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none min-w-0"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setActivePlaylist(playlist.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-colors text-left
                    ${activePlaylistId === playlist.id
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}
                  `}
                  title={isCollapsed ? playlist.name : undefined}
                >
                  <ListMusic className="w-5 h-5 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{playlist.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                      {/* Three-dot context menu trigger */}
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === playlist.id ? null : playlist.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all shrink-0"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </button>
              )}

              {/* Context Menu Dropdown */}
              {menuOpenId === playlist.id && !isCollapsed && (
                <div
                  className="absolute right-2 top-10 z-50 w-40 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-1 overflow-hidden"
                  onMouseDown={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => startRename(playlist.id, playlist.name)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(playlist.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {playlists.length === 0 && !isCollapsed && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                No playlists yet.
                <br />
                Hit <span className="font-semibold text-indigo-500">+</span> to create one.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}