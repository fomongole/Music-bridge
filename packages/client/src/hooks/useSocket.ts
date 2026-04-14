// packages/client/src/hooks/useSocket.ts

import { useEffect, useState } from 'react'
import socket from '../services/socket'

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [deviceConnected, setDeviceConnected] = useState(false)

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('device:connected', () => setDeviceConnected(true))
    socket.on('device:disconnected', () => setDeviceConnected(false))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('device:connected')
      socket.off('device:disconnected')
    }
  }, [])

  return { connected, deviceConnected, socket }
}