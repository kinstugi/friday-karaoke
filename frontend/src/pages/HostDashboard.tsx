import { Avatar, Box, Button, CircularProgress, Container, Grid, IconButton, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import SessionCard from '../components/SessionCard'
import { useAuth } from '../context/AuthContext'
import { useHostSessions } from '../hooks/useHostSessions'

function HostDashboard({ onSignOut, onCreateSession }: { onSignOut: () => void; onCreateSession: () => void }) {
  const { user, logOut } = useAuth()
  const { sessions, loading, error } = useHostSessions(user?.uid)

  async function signOut() { await logOut(); onSignOut() }

  return <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', bgcolor: '#17101f', color: 'white' }}>
    <Box className="dashboard-orb orb-one" /><Box className="dashboard-orb orb-two" />
    <Box component="header" sx={{ position: 'relative', zIndex: 1, py: 2.5, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <GraphicEqRoundedIcon sx={{ color: 'primary.main' }} />
            <Typography fontWeight={700}>Singalong</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14 }}>{(user?.email?.[0] ?? 'H').toUpperCase()}</Avatar>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{user?.email ?? 'Host'}</Typography>
            <IconButton onClick={() => void signOut()} color="inherit" aria-label="sign out"><LogoutRoundedIcon fontSize="small" /></IconButton>
          </Stack>
        </Stack>
      </Container>
    </Box>
    <Container component="main" maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 6, md: 10 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={3} mb={{ xs: 7, md: 10 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '.16em' }}>YOUR HOST SPACE</Typography>
          <Typography variant="h2" sx={{ mt: 1, fontSize: { xs: '2.7rem', md: '4rem' }, letterSpacing: '-.06em' }}>Make some noise.</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Start a room and let your guests take over the queue.</Typography>
        </Box>
        <Button onClick={onCreateSession} variant="contained" size="large" startIcon={<AddRoundedIcon />} sx={{ px: 2.5, flexShrink: 0 }}>Create a room</Button>
      </Stack>
      {error && <Typography color="error.main" sx={{ mb: 3 }}>Could not load your sessions. Check your Firestore rules and try again.</Typography>}
      {
        loading ? 
        <Stack alignItems="center" py={8}>
          <CircularProgress color="secondary" />
        </Stack> : 
        sessions.length === 0 ? 
        <EmptySessions onCreateSession={onCreateSession} /> : 
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="end">
            <Box>
              <Typography variant="h5" fontWeight={700}>Previous sessions</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: .5 }}>Your past karaoke nights</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {sessions.map((session, index) => <Grid key={session.id} size={{ xs: 12, sm: 6, md: 4 }}><SessionCard title={session.title} date={session.createdAt ? session.createdAt.toLocaleDateString() : 'Just created'} songs={session.songsCount} guests={session.guestsCount} color={['#57317a', '#8b385e', '#315c69'][index % 3]} roomCode={session.roomCode} /></Grid>)}</Grid></Stack>}<Box sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid rgba(255,255,255,.1)', bgcolor: 'rgba(255,255,255,.04)' }}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2}><Box><Typography variant="h6" fontWeight={700}>The stage is yours.</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: .5 }}>Every great karaoke night starts with one song.</Typography></Box><Button onClick={onCreateSession} color="secondary" endIcon={<ArrowForwardRoundedIcon />}>Start a new session</Button></Stack></Box></Container></Box>
}

function EmptySessions({ onCreateSession }: { onCreateSession: () => void }) { return <Box sx={{ py: { xs: 6, md: 10 }, px: 3, textAlign: 'center', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 3, bgcolor: 'rgba(255,255,255,.025)' }}><Typography variant="h5" fontWeight={700}>Your first room is waiting.</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Create a session and invite your friends to sing along.</Typography><Button onClick={onCreateSession} variant="contained" startIcon={<AddRoundedIcon />}>Create your first room</Button></Box> }

export default HostDashboard
