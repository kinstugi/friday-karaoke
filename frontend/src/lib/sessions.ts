import { addDoc, collection, getDocs, onSnapshot, query, serverTimestamp, where, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'

export type KaraokeSession = {
  id: string
  title: string
  hostId: string
  roomCode: string
  songsCount: number
  guestsCount: number
  createdAt: Date | null
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function createSession(hostId: string, title: string) {
  return addDoc(collection(db, 'sessions'), {
    title: title.trim(),
    hostId,
    roomCode: createRoomCode(),
    songsCount: 0,
    guestsCount: 0,
    createdAt: serverTimestamp(),
  })
}

export async function findSessionByCode(roomCode: string) {
  const snapshot = await getDocs(query(collection(db, 'sessions'), where('roomCode', '==', roomCode.toUpperCase())))
  const session = snapshot.docs[0]
  if (!session) return null
  const data = session.data()
  return { id: session.id, title: data.title as string, hostId: data.hostId as string, roomCode: data.roomCode as string }
}

export function subscribeToHostSessions(hostId: string, onChange: (sessions: KaraokeSession[]) => void, onError: (error: Error) => void): Unsubscribe {
  const sessionsQuery = query(collection(db, 'sessions'), where('hostId', '==', hostId))
  return onSnapshot(sessionsQuery, (snapshot) => {
    const sessions = snapshot.docs.map((snapshotDoc) => {
      const data = snapshotDoc.data()
      const timestamp = data.createdAt
      return { id: snapshotDoc.id, title: data.title, hostId: data.hostId, roomCode: data.roomCode, songsCount: data.songsCount ?? 0, guestsCount: data.guestsCount ?? 0, createdAt: timestamp?.toDate?.() ?? null }
    }).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    onChange(sessions)
  }, onError)
}
