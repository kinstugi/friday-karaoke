import { useState } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { createTheme } from '@mui/material/styles'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import HostDashboard from './pages/HostDashboard'
import CreateSessionPage from './pages/CreateSessionPage'
import RoomPage from './pages/RoomPage'
import JoinRoomPage from './pages/JoinRoomPage'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ffca5f', contrastText: '#241329' },
    secondary: { main: '#ec7197' },
    background: { default: '#17101f', paper: '#24152f' },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    h1: { fontFamily: 'Space Grotesk, Inter, sans-serif', fontWeight: 700 },
    h2: { fontFamily: 'Space Grotesk, Inter, sans-serif', fontWeight: 700 },
    h3: { fontFamily: 'Space Grotesk, Inter, sans-serif', fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
})

function App() {
  const joinCode = window.location.pathname.match(/^\/join\/([^/]+)/)?.[1]
  const [page, setPage] = useState<'landing' | 'auth' | 'dashboard' | 'create' | 'room' | 'join'>(joinCode ? 'join' : 'landing')
  const [room, setRoom] = useState({ title: 'Singalong Session', code: 'SING-42' })
  return <ThemeProvider theme={theme}><CssBaseline />{page === 'landing' ? <LandingPage onOpenAuth={() => setPage('auth')} /> : page === 'auth' ? <AuthPage onBack={() => setPage('landing')} onAuthenticated={() => setPage('dashboard')} /> : page === 'create' ? <CreateSessionPage onBack={() => setPage('dashboard')} onCreated={() => setPage('dashboard')} /> : page === 'room' ? <RoomPage title={room.title} code={room.code} onExit={() => setPage('dashboard')} /> : page === 'join' && joinCode ? <JoinRoomPage code={joinCode} onBack={() => setPage('landing')} /> : <HostDashboard onSignOut={() => setPage('landing')} onCreateSession={() => setPage('create')} onOpenSession={(title, code) => { setRoom({ title, code }); setPage('room') }} />}</ThemeProvider>
}

export default App
