import { io, Socket } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const socket: Socket = io(SERVER_URL)

export default socket