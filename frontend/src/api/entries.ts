// API calls for songs and the queue (backend M6/M7).
import { apiRequest } from './client'
import type { QueueSnapshot, SongPreview, SongSubmitResult } from './types'

export function fetchPreview(
  sessionId: string,
  token: string,
  youtubeUrl: string,
): Promise<SongPreview> {
  return apiRequest<SongPreview>(
    `/api/v1/sessions/${sessionId}/entries/preview`,
    { method: 'POST', body: { youtube_url: youtubeUrl }, token },
  )
}

export function submitSong(
  sessionId: string,
  token: string,
  youtubeUrl: string,
): Promise<SongSubmitResult> {
  return apiRequest<SongSubmitResult>(`/api/v1/sessions/${sessionId}/entries`, {
    method: 'POST',
    body: { youtube_url: youtubeUrl },
    token,
  })
}

export function fetchQueueSnapshot(sessionId: string): Promise<QueueSnapshot> {
  return apiRequest<QueueSnapshot>(`/api/v1/sessions/${sessionId}/entries`)
}

export function cancelEntry(entryId: string, token: string): Promise<void> {
  return apiRequest<void>(`/api/v1/entries/${entryId}`, {
    method: 'DELETE',
    token,
  })
}
