// 1. Check if Electron passed a dynamic port in the URL
const params = new URLSearchParams(window.location.search)
const dynamicPort = params.get('serverPort')

// 2. If it did, use it! Otherwise, fall back to the .env or 3001
export const SERVER_URL = dynamicPort 
  ? `http://localhost:${dynamicPort}` 
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')