import { useState, type FormEvent } from 'react'
import { Alert, Avatar, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Fab, IconButton, InputAdornment, List, ListItem, ListItemAvatar, ListItemText, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded'
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import { useAuth } from '../context/AuthContext'
import { addSong, findSessionByCode, getQueueSongs, joinSession, setParticipantVisibility } from '../lib/sessions'
import { useSessionSongs } from '../hooks/useSessionSongs'
import { useParticipantSongs } from '../hooks/useParticipantSongs'

function JoinRoomPage({ code, onBack }: { code: string; onBack: () => void }) {
  const { signInAnonymously } = useAuth()
  const [nickname, setNickname] = useState('')
  const [roomTitle, setRoomTitle] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [joined, setJoined] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function joinRoom(event: FormEvent) {
    event.preventDefault(); if (!nickname.trim()) return
    setLoading(true); setError('')
    try { const anonymousUser = await signInAnonymously(); const session = await findSessionByCode(code); if (!session) { setError('That room could not be found. Check the invite link and try again.'); return }; await joinSession(session.id, anonymousUser.uid, nickname); setParticipantId(anonymousUser.uid); setSessionId(session.id); setRoomTitle(session.title); setJoined(true) }
    catch (joinError) { setError(joinError instanceof Error ? joinError.message : 'Unable to join this room.') }
    finally { setLoading(false) }
  }

  if (joined) return <ParticipantRoom title={roomTitle} code={code} nickname={nickname} sessionId={sessionId} participantId={participantId} />
  return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4, bgcolor: '#17101f', color: 'white', background: 'radial-gradient(circle at 80% 20%, #452350 0, transparent 32%), #17101f' }}><Container maxWidth="sm"><Button onClick={onBack} startIcon={<ArrowBackRoundedIcon />} color="inherit" sx={{ mb: 3 }}>Back to home</Button><Paper component="form" onSubmit={joinRoom} elevation={0} sx={{ p: { xs: 3, sm: 5 }, bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,.1)', borderRadius: 3 }}><Stack spacing={3} alignItems="center"><GraphicEqRoundedIcon sx={{ color: 'primary.main', fontSize: 42 }} /><Typography variant="h4" fontWeight={700} textAlign="center">Join the singalong</Typography><Typography color="text.secondary" textAlign="center">You’re joining room <strong>{code.toUpperCase()}</strong>. No account needed.</Typography>{error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}<TextField autoFocus required fullWidth label="Choose a nickname" placeholder="e.g. Karaoke Queen" value={nickname} onChange={(event) => setNickname(event.target.value)} inputProps={{ maxLength: 24 }} helperText="This is how other guests will see you." /><Button type="submit" fullWidth size="large" variant="contained" disabled={loading || !nickname.trim()}>{loading ? 'Joining room…' : 'Join room'}</Button></Stack></Paper></Container></Box>
}

const queue = [
  { title: 'Don’t Stop Believin’', artist: 'Journey', singer: 'Alex', color: '#ec7197' },
  { title: 'Dancing Queen', artist: 'ABBA', singer: 'Maya', color: '#ffca5f' },
  { title: 'Mr. Brightside', artist: 'The Killers', singer: 'Jordan', color: '#8f7bff' },
]

function ParticipantRoom({ title, code, nickname, sessionId, participantId }: { title: string; code: string; nickname: string; sessionId: string; participantId: string }) {
  const { songs: queueSongs, error: songsError } = useSessionSongs(sessionId)
  const { songs: personalSongs, error: personalSongsError } = useParticipantSongs(sessionId, participantId)
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [songTitle, setSongTitle] = useState('')
  const [songUrl, setSongUrl] = useState('')
  const [songError, setSongError] = useState('')
  const [titleLoading, setTitleLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const visibleSongs = tab === 0 ? getQueueSongs(queueSongs) : personalSongs

  async function toggleAvailability() { if (!participantId || saving) return; const nextValue = !available; setSaving(true); try { await setParticipantVisibility(sessionId, participantId, nextValue); setAvailable(nextValue) } finally { setSaving(false) } }
  async function fetchSongTitle() {
    if (!songUrl.trim() || titleLoading) return
    setTitleLoading(true)
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(songUrl.trim())}&format=json`)
      if (!response.ok) throw new Error('Could not find video')
      const data = await response.json() as { title?: string }
      if (data.title) setSongTitle(data.title)
    } catch {
      // The title remains editable if YouTube oEmbed is unavailable.
    } finally { setTitleLoading(false) }
  }

  async function submitSong() {
    if (!participantId || !songTitle.trim() || !songUrl.trim()) return
    setSaving(true); setSongError('')
    try { await addSong(sessionId, participantId, nickname, songTitle, songUrl); setSongTitle(''); setSongUrl(''); setAddOpen(false); setAdded(true); window.setTimeout(() => setAdded(false), 2200) }
    catch { setSongError('Could not add this song. Check the link and try again.') }
    finally { setSaving(false) }
  }

  return <Box sx={{ minHeight: '100vh', bgcolor: '#0d0a12', color: 'white', pb: 10 }}><Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'rgba(13,10,18,.94)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,.1)' }}><Container maxWidth="lg"><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ minHeight: 64, gap: 2 }}><Stack direction="row" spacing={1} alignItems="center" minWidth={0}><GraphicEqRoundedIcon sx={{ color: 'primary.main' }} /><Typography fontWeight={700} noWrap>{title}</Typography></Stack><Stack direction="row" spacing={1} alignItems="center"><Button onClick={() => void toggleAvailability()} disabled={saving} size="small" variant="outlined" color={available ? 'success' : 'warning'}>{available ? 'Available' : 'On break'}</Button><Avatar sx={{ width: 30, height: 30, bgcolor: 'secondary.main', fontSize: 13 }}>{nickname[0].toUpperCase()}</Avatar></Stack></Stack></Container></Box><Container maxWidth="lg" sx={{ pt: 3 }}><Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, bgcolor: '#21152a', border: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(110deg, #30203d, #1e1427)' }}><Stack spacing={1}><Typography variant="overline" color="secondary.main" letterSpacing=".14em">NOW PLAYING</Typography><Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' } }}>Waiting for the first song</Typography><Typography color="text.secondary">The lyrics will appear here when the host starts the music.</Typography><Stack direction="row" spacing={.7} sx={{ pt: 2 }}>{[0, 1, 2, 3, 4, 5, 6].map((bar) => <Box key={bar} sx={{ width: 4, height: 20 + ((bar * 13) % 26), borderRadius: 2, bgcolor: bar < 3 ? 'secondary.main' : 'rgba(255,255,255,.16)' }} />)}</Stack></Stack></Paper><Stack direction="row" justifyContent="space-between" alignItems="end" sx={{ mt: 5, mb: 2 }}><Box><Typography variant="h5" fontWeight={700}>{tab === 0 ? 'Room queue' : 'My playlist'}</Typography><Typography variant="body2" color="text.secondary">{tab === 0 ? 'Songs are ordered by the time they were added' : 'Songs you added to this room'}</Typography></Box><Typography variant="caption" color="text.secondary">{visibleSongs.length} songs</Typography></Stack>{(songsError || personalSongsError) && <Alert severity="error" sx={{ mb: 2 }}>Could not load songs: {songsError || personalSongsError}</Alert>}<List disablePadding>{visibleSongs.length === 0 ? <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No songs here yet. Be the first to add one.</Typography> : visibleSongs.map((song, index) => <ListItem key={song.id} disableGutters sx={{ py: 1.7, borderBottom: '1px solid rgba(255,255,255,.08)' }}><ListItemAvatar><Avatar sx={{ bgcolor: ['#ec7197', '#ffca5f', '#8f7bff'][index % 3], color: '#17101f', fontWeight: 700 }}>{index + 1}</Avatar></ListItemAvatar><ListItemText primary={song.title} secondary={`${song.requesterName} · ${song.status}`} primaryTypographyProps={{ fontWeight: 700 }} secondaryTypographyProps={{ color: 'text.secondary', sx: { textTransform: 'capitalize' } }} /></ListItem>)}</List>{added && <Alert severity="success" sx={{ mt: 2 }}>Song added to the queue.</Alert>}</Container><Fab color="secondary" aria-label="add a song" onClick={() => setAddOpen(true)} sx={{ position: 'fixed', right: { xs: 20, md: 36 }, bottom: 78, zIndex: 3, color: 'white' }}><AddRoundedIcon /></Fab><Paper elevation={8} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2, bgcolor: '#1a111f', borderTop: '1px solid rgba(255,255,255,.1)', borderRadius: 0 }}><Container maxWidth="sm"><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" textColor="secondary" indicatorColor="secondary"><Tab icon={<QueueMusicRoundedIcon />} label="Queue" /><Tab icon={<LibraryMusicRoundedIcon />} label="My playlist" /></Tabs></Container></Paper><Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Add a song</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Add a YouTube song for everyone in the room.</Typography>{songError && <Alert severity="error" sx={{ mb: 2 }}>{songError}</Alert>}<Stack spacing={2}><TextField autoFocus fullWidth required label="Song title" placeholder="Paste a link to fetch the title" value={songTitle} onChange={(event) => setSongTitle(event.target.value)} helperText={titleLoading ? 'Fetching title from YouTube…' : 'We’ll fill this from YouTube, and you can edit it.'} /><TextField fullWidth required label="YouTube URL" placeholder="https://youtube.com/watch?v=..." value={songUrl} onChange={(event) => setSongUrl(event.target.value)} onBlur={() => void fetchSongTitle()} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }} /></Stack></DialogContent><DialogActions sx={{ p: 2 }}><Button onClick={() => setAddOpen(false)} color="inherit">Cancel</Button><Button onClick={() => void submitSong()} disabled={saving || !songTitle.trim() || !songUrl.trim()} variant="contained" startIcon={<SendRoundedIcon />}>{saving ? 'Adding…' : 'Add to queue'}</Button></DialogActions></Dialog></Box>
}

export default JoinRoomPage
