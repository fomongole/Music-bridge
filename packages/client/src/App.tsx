// packages/client/src/App.tsx

import { useSocket } from './hooks/useSocket'

function App() {
  const { connected, deviceConnected } = useSocket()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold mb-6">MusicBridge</h1>

        <div className="flex items-center gap-2 justify-center">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">
            {connected ? 'Server connected' : 'Server disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-center">
          <div className={`w-2 h-2 rounded-full ${deviceConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-sm text-gray-400">
            {deviceConnected ? 'Android device connected' : 'No device detected'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App