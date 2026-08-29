// Optimistic queue overlay. The backend/database remains authoritative; this
// provider only keeps temporary rows visible while background POSTs sync and the
// next authoritative snapshot arrives over REST/WebSocket.
import { type ReactNode, useCallback, useMemo, useState } from 'react'

import { submitSong } from '../api/entries'
import { addHostParticipantSong } from '../api/host'
import type { QueueEntry, SongSubmitResult } from '../api/types'
import { cacheQueueEntryMetadata } from '../lib/youtube'
import {
  type BaseAddInput,
  type CacheableEntry,
  type HostAddInput,
  QueueContext,
  type QueueContextValue,
  type QueueDisplayEntry,
} from './context'

function tempId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `temp-${crypto.randomUUID()}`
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function optimisticEntry(input: BaseAddInput): QueueDisplayEntry {
  return {
    id: tempId(),
    participant_name: input.participantName,
    status: 'WAITING',
    video_id: input.metadata.videoId,
    youtube_url: input.metadata.youtubeUrl,
    title: input.metadata.title,
    channel: input.metadata.channel,
    duration_seconds: input.metadata.durationSeconds ?? 0,
    thumbnail_url: input.metadata.thumbnailUrl,
    position: null,
    created_at: new Date().toISOString(),
    optimistic_status: 'syncing',
  }
}

function isConfirmedBySnapshot(entry: QueueDisplayEntry, snapshotEntries: CacheableEntry[]): boolean {
  if (!entry.server_id) return false
  return snapshotEntries.some((candidate) => candidate.id === entry.server_id)
}

export function QueueProvider({ children }: { children: ReactNode }) {
  const [optimisticEntries, setOptimisticEntries] = useState<QueueDisplayEntry[]>([])

  const clearSynced = useCallback((entries: CacheableEntry[]): void => {
    setOptimisticEntries((prev) =>
      prev.filter((entry) => !isConfirmedBySnapshot(entry, entries)),
    )
    entries.forEach(cacheQueueEntryMetadata)
  }, [])

  const mergedQueue = useCallback((queue: QueueEntry[]): QueueDisplayEntry[] => {
    const hiddenServerIds = new Set(queue.map((entry) => entry.id))
    const visibleOptimistic = optimisticEntries.filter(
      (entry) => !entry.server_id || !hiddenServerIds.has(entry.server_id),
    )
    return [...queue, ...visibleOptimistic]
  }, [optimisticEntries])

  const mergedMine = useCallback((
    entries: QueueEntry[],
    participantName: string,
  ): QueueDisplayEntry[] => {
    const hiddenServerIds = new Set(entries.map((entry) => entry.id))
    const mine = optimisticEntries.filter(
      (entry) =>
        entry.participant_name === participantName &&
        (!entry.server_id || !hiddenServerIds.has(entry.server_id)),
    )
    return [...entries, ...mine]
  }, [optimisticEntries])

  const addParticipantSong = useCallback(async (
    input: BaseAddInput,
  ): Promise<SongSubmitResult> => {
    const entry = optimisticEntry(input)
    setOptimisticEntries((prev) => [...prev, entry])
    try {
      const result = await submitSong(input.sessionId, input.token, input.metadata.youtubeUrl)
      cacheQueueEntryMetadata(result.entry)
      setOptimisticEntries((prev) =>
        prev.map((candidate) =>
          candidate.id === entry.id
            ? { ...candidate, ...result.entry, id: candidate.id, server_id: result.entry.id }
            : candidate,
        ),
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add the song'
      setOptimisticEntries((prev) =>
        prev.map((candidate) =>
          candidate.id === entry.id
            ? { ...candidate, optimistic_status: 'failed', optimistic_error: message }
            : candidate,
        ),
      )
      throw err
    }
  }, [])

  const addHostSong = useCallback(async (input: HostAddInput): Promise<SongSubmitResult> => {
    const entry = optimisticEntry(input)
    setOptimisticEntries((prev) => [...prev, entry])
    try {
      const result = await addHostParticipantSong(
        input.token,
        input.sessionId,
        input.participantId,
        input.metadata.youtubeUrl,
      )
      cacheQueueEntryMetadata(result.entry)
      setOptimisticEntries((prev) =>
        prev.map((candidate) =>
          candidate.id === entry.id
            ? { ...candidate, ...result.entry, id: candidate.id, server_id: result.entry.id }
            : candidate,
        ),
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add this song'
      setOptimisticEntries((prev) =>
        prev.map((candidate) =>
          candidate.id === entry.id
            ? { ...candidate, optimistic_status: 'failed', optimistic_error: message }
            : candidate,
        ),
      )
      throw err
    }
  }, [])

  const value = useMemo<QueueContextValue>(
    () => ({
      optimisticEntries,
      mergedQueue,
      mergedMine,
      addParticipantSong,
      addHostSong,
      clearSynced,
    }),
    [
      optimisticEntries,
      mergedQueue,
      mergedMine,
      addParticipantSong,
      addHostSong,
      clearSynced,
    ],
  )

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}
