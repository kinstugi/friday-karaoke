import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Container, Divider, FormControlLabel, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import GoogleIcon from '@mui/icons-material/Google'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import { useAuth } from '../context/AuthContext'

function authErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return 'Something went wrong. Please try again.'
  switch (error.code) {
    case 'auth/invalid-credential': return 'Your email or password is incorrect.'
    case 'auth/email-already-in-use': return 'An account already exists with this email.'
    case 'auth/weak-password': return 'Use a password with at least 6 characters.'
    case 'auth/invalid-email': return 'Enter a valid email address.'
    case 'auth/popup-closed-by-user': return 'The Google sign-in window was closed.'
    default: return 'Unable to sign you in right now. Please try again.'
  }
}

function AuthPage({ onBack, onAuthenticated }: { onBack: () => void; onAuthenticated: () => void }) {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submitEmailAuth() {
    setError('')
    setSuccess(false)
    setBusy(true)
    try {
      if (isSignUp) await signUp(email, password)
      else await signIn(email, password)
      onAuthenticated()
    } catch (authError) {
      setError(authErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  async function continueWithGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
      onAuthenticated()
    } catch (authError) {
      setError(authErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4, background: 'radial-gradient(circle at 20% 20%, #452350 0, transparent 30%), #17101f' }}><Container maxWidth="sm"><Button onClick={onBack} startIcon={<ArrowBackRoundedIcon />} color="inherit" sx={{ mb: 3 }}>Back to home</Button><Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,.1)', borderRadius: 3 }}><Stack spacing={3}><Stack alignItems="center" spacing={1}><GraphicEqRoundedIcon sx={{ color: 'primary.main', fontSize: 34 }} /><Typography variant="h4" fontWeight={700}>{isSignUp ? 'Create your account' : 'Welcome back'}</Typography><Typography color="text.secondary" textAlign="center">{isSignUp ? 'Get your crew together and start singing.' : 'Sign in to keep the music going.'}</Typography></Stack>{error && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">You’re signed in! Authentication is working.</Alert>}<Button onClick={continueWithGoogle} disabled={busy} variant="outlined" color="inherit" fullWidth startIcon={<GoogleIcon />} sx={{ py: 1.3, borderColor: 'rgba(255,255,255,.2)' }}>Continue with Google</Button><Divider><Typography variant="caption" color="text.secondary">OR CONTINUE WITH EMAIL</Typography></Divider><Box component="form" onSubmit={(event) => { event.preventDefault(); void submitEmailAuth() }}><Stack spacing={2}><TextField label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth required /><TextField label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} fullWidth required InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end" color="inherit" aria-label="toggle password visibility">{showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton></InputAdornment> }} />{isSignUp ? <FormControlLabel control={<Checkbox required />} label={<Typography variant="body2">I agree to the terms and privacy policy.</Typography>} /> : <Stack direction="row" justifyContent="space-between" alignItems="center"><FormControlLabel control={<Checkbox />} label="Remember me" /><Link href="#" variant="body2" color="primary.main">Forgot password?</Link></Stack>}<Button type="submit" variant="contained" size="large" fullWidth disabled={busy}>{busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</Button></Stack></Box></Stack><Typography textAlign="center" variant="body2" color="text.secondary">{isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}<Link component="button" type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(false) }} color="primary.main" underline="hover">{isSignUp ? 'Sign in' : 'Sign up'}</Link></Typography></Paper></Container></Box>
}

export default AuthPage
