import { useState } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { createTheme } from '@mui/material/styles'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import HostDashboard from './pages/HostDashboard'
import CreateSessionPage from './pages/CreateSessionPage'

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
  const [page, setPage] = useState<'landing' | 'auth' | 'dashboard' | 'create'>('landing')
  return <ThemeProvider theme={theme}><CssBaseline />{page === 'landing' ? <LandingPage onOpenAuth={() => setPage('auth')} /> : page === 'auth' ? <AuthPage onBack={() => setPage('landing')} onAuthenticated={() => setPage('dashboard')} /> : page === 'create' ? <CreateSessionPage onBack={() => setPage('dashboard')} onCreated={() => setPage('dashboard')} /> : <HostDashboard onSignOut={() => setPage('landing')} onCreateSession={() => setPage('create')} />}</ThemeProvider>
}

export default App
