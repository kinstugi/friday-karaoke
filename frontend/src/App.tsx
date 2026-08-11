import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import JoinScreen from './features/join/JoinScreen'
import QueueScreen from './features/queue/QueueScreen'
import SubmitSongScreen from './features/submit/SubmitSongScreen'
import './App.css'

function ScanLanding() {
  return (
    <div className="screen">
      <h1>Friday Karaoke</h1>
      <p className="muted">
        Scan the QR code on the screen to join tonight&rsquo;s karaoke.
      </p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<ScanLanding />} />
        <Route path="/join/:joinCode" element={<JoinScreen />} />
        <Route path="/join/:joinCode/queue" element={<QueueScreen />} />
        <Route path="/join/:joinCode/submit" element={<SubmitSongScreen />} />
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
