import { useEffect, useState } from 'react'
import socket from '../services/socket'
import type { Track } from '../types/Track'

type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error'

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [deviceConnected, setDeviceConnected] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanError, setScanError] = useState<string | null>(null)

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('device:connected', () => setDeviceConnected(true))
    socket.on('device:disconnected', () => setDeviceConnected(false))

    socket.on('scan:started', () => {
      setTracks([])
      setScanStatus('scanning')
      setScanError(null)
    })

    socket.on('track:found', (track: Track) => {
      setTracks((prev) => [...prev, track])
    })

    socket.on('scan:complete', () => {
      setScanStatus('complete')
    })

    socket.on('scan:error', ({ message }: { message: string }) => {
      setScanStatus('error')
      setScanError(message)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('device:connected')
      socket.off('device:disconnected')
      socket.off('scan:started')
      socket.off('track:found')
      socket.off('scan:complete')
      socket.off('scan:error')
    }
  }, [])

  const requestScan = () => {
    if (scanStatus !== 'scanning') {
      socket.emit('scan:request')
    }
  }

  return { connected, deviceConnected, tracks, scanStatus, scanError, requestScan }
}