import { Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'

type SessionCardProps = { title: string; date: string; songs: number; guests: number; color: string; roomCode?: string; onView?: () => void }

function SessionCard({ title, date, songs, guests, color, roomCode, onView }: SessionCardProps) {
  return <Card elevation={0} sx={{ height: '100%', bgcolor: color, color: 'white', border: '1px solid rgba(255,255,255,.12)', borderRadius: 3, transition: 'transform .25s, box-shadow .25s', '&:hover': { transform: 'translateY(-6px)', boxShadow: `0 18px 45px ${color}88` } }}><CardContent sx={{ p: 3, minHeight: 210, display: 'flex', flexDirection: 'column' }}><Stack direction="row" justifyContent="space-between" alignItems="start"><Chip label={roomCode ?? 'PAST SESSION'} size="small" sx={{ bgcolor: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.85)', fontSize: 10, letterSpacing: '.08em' }} /><ArrowOutwardRoundedIcon sx={{ color: 'rgba(255,255,255,.7)' }} /></Stack><Typography variant="h5" fontWeight={700} sx={{ mt: 5, letterSpacing: '-.04em' }}>{title}</Typography><Typography variant="body2" sx={{ mt: .5, color: 'rgba(255,255,255,.65)' }}>{date}</Typography><Stack direction="row" spacing={3} sx={{ mt: 'auto', pt: 3 }}><Typography variant="caption" sx={{ color: 'rgba(255,255,255,.7)' }}><strong>{songs}</strong> songs</Typography><Typography variant="caption" sx={{ color: 'rgba(255,255,255,.7)' }}><strong>{guests}</strong> guests</Typography><Button onClick={onView} variant="text" size="small" sx={{ ml: 'auto', minWidth: 0, p: 0, color: 'white' }}>View</Button></Stack></CardContent></Card>
}

export default SessionCard
