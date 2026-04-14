import { useTheme } from 'next-themes'
import { MonitorSmartphone, Server, Sun, Moon, Laptop, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

interface HeaderProps {
  connected: boolean
  deviceConnected: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  hasTracks: boolean // Only show search if there are tracks to search
}

export function Header({ connected, deviceConnected, searchQuery, setSearchQuery, hasTracks }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), [])

  return (
    <header className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5 transition-colors duration-300 gap-4">
      
      {/* 1. Logo Section (Left) */}
      <div className="flex items-center gap-3 md:w-1/3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <MonitorSmartphone className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden sm:block text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          MusicBridge
        </h1>
      </div>

      {/* 2. Global Search (Center) */}
      <div className="flex-1 max-w-md w-full">
        {hasTracks && (
          <div className="relative w-full transition-all duration-300 focus-within:scale-[1.02]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tracks, artists, albums..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-200/50 dark:bg-zinc-900/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-sm shadow-inner dark:shadow-none"
            />
          </div>
        )}
      </div>

      {/* 3. Status & Theme Toggle (Right) */}
      <div className="flex items-center justify-end gap-6 md:w-1/3 shrink-0">
        {/* Status Indicators */}
        <div className="hidden lg:flex items-center gap-4 bg-slate-200/50 dark:bg-zinc-900/50 px-4 py-2 rounded-full border border-slate-300/50 dark:border-white/5">
          <div className="flex items-center gap-2" title="Server Status">
            <Server className={`w-4 h-4 ${connected ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="w-[1px] h-4 bg-slate-300 dark:bg-white/10" />
          <div className="flex items-center gap-2" title="Device Status">
            <MonitorSmartphone className={`w-4 h-4 ${deviceConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
        </div>

        {/* Theme Toggle */}
        {mounted && (
          <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-zinc-900/50 p-1 rounded-full border border-slate-300/50 dark:border-white/5">
            <button onClick={() => setTheme('light')} className={`p-1.5 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}>
              <Sun className="w-4 h-4" />
            </button>
            <button onClick={() => setTheme('system')} className={`p-1.5 rounded-full transition-all ${theme === 'system' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
              <Laptop className="w-4 h-4" />
            </button>
            <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-full transition-all ${theme === 'dark' ? 'bg-zinc-800 shadow-sm text-indigo-400' : 'text-slate-400 hover:text-white'}`}>
              <Moon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </header>
  )
}