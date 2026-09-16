import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<User>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    setLoading(false)
  }), [])

  const value = useMemo(() => ({
    user,
    loading,
    signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password).then(() => undefined),
    signUp: (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password).then(() => undefined),
    signInWithGoogle: () => signInWithPopup(auth, googleProvider).then(() => undefined),
    signInAnonymously: () => signInAnonymously(auth).then((credential) => credential.user),
    logOut: () => signOut(auth),
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
