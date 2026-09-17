import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore'
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

export type SessionParticipant = { id: string; nickname: string; joinedAt: Date | null; visibility: boolean; addedByHost?: boolean }
export type SessionSong = { id: string; participantId: string; title: string; youtubeUrl: string; requesterName: string; createdAt: Date | null; played: boolean; status: 'queued' | 'playing' | 'done' }

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

export async function joinSession(sessionId: string, userId: string, nickname: string) {
  await setDoc(doc(db, 'sessions', sessionId, 'participants', userId), {
    nickname: nickname.trim(),
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    visibility: true,
  }, { merge: true })
}

export async function addHostParticipant(sessionId: string, nickname: string) {
  const participantId = `host-${crypto.randomUUID()}`
  await setDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
    nickname: nickname.trim(),
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    visibility: true,
    addedByHost: true,
  })
}

export function subscribeToParticipants(sessionId: string, onChange: (participants: SessionParticipant[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, 'sessions', sessionId, 'participants'), (snapshot) => {
    const participants = snapshot.docs.map((participantDoc) => {
      const data = participantDoc.data()
      // Only an explicit boolean false means unavailable. This keeps older
      // participant documents visible until they are updated again.
      return { id: participantDoc.id, nickname: data.nickname as string, joinedAt: data.joinedAt?.toDate?.() ?? null, visibility: data.visibility !== false, addedByHost: data.addedByHost === true }
    }).sort((a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0))
    onChange(participants)
  }, onError)
}

export async function setParticipantVisibility(sessionId: string, participantId: string, visibility: boolean) {
  await updateDoc(doc(db, 'sessions', sessionId, 'participants', participantId), { visibility, lastSeenAt: serverTimestamp() })
}

export async function addSong(sessionId: string, participantId: string, requesterName: string, title: string, youtubeUrl: string) {
  return addDoc(collection(db, 'sessions', sessionId, 'participants', participantId, 'songs'), { sessionId, requesterId: participantId, requesterName: requesterName.trim(), title: title.trim(), youtubeUrl: youtubeUrl.trim(), status: 'queued', played: false, createdAt: serverTimestamp() })
}

export function subscribeToSongs(sessionId: string, onChange: (songs: SessionSong[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, 'sessions', sessionId, 'queue'), (snapshot) => {
    const songs = snapshot.docs.map((songDoc) => { const data = songDoc.data(); return { id: songDoc.id, participantId: data.participantId as string, title: data.title as string, youtubeUrl: data.youtubeUrl as string, requesterName: data.requesterName as string, status: data.status as SessionSong['status'], played: data.played === true, createdAt: data.createdAt?.toDate?.() ?? null } }).sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    onChange(songs)
  }, onError)
}

export function subscribeToParticipantSongs(sessionId: string, participantId: string, onChange: (songs: SessionSong[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, 'sessions', sessionId, 'participants', participantId, 'songs'), (snapshot) => {
    const songs = snapshot.docs.map((songDoc) => { const data = songDoc.data(); return { id: songDoc.id, participantId, title: data.title as string, youtubeUrl: data.youtubeUrl as string, requesterName: data.requesterName as string, status: data.status as SessionSong['status'], played: data.played === true, createdAt: data.createdAt?.toDate?.() ?? null } }).sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    onChange(songs)
  }, onError)
}

export function getQueueSongs(songs: SessionSong[]) {
  const firstUnplayedByParticipant = new Map<string, SessionSong>()
  for (const song of songs) {
    if (!song.played && !firstUnplayedByParticipant.has(song.participantId)) firstUnplayedByParticipant.set(song.participantId, song)
  }
  return [...firstUnplayedByParticipant.values()].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
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
