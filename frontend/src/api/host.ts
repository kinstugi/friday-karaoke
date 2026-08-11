// API calls for the host dashboard (backend M3 host auth + M4/M5 sessions).
import { apiRequest, apiRequestText } from './client'
import type { HostLoginResult, HostProfile, Session } from './types'

const AUTH_BASE = '/api/v1/auth/host'
const SESSIONS_BASE = '/api/v1/sessions'

export function registerHost(
  email: string,
  password: string,
): Promise<HostProfile> {
  return apiRequest<HostProfile>(`${AUTH_BASE}/register`, {
    method: 'POST',
    body: { email, password },
  })
}

export function loginHost(email: string, password: string): Promise<HostLoginResult> {
  return apiRequest<HostLoginResult>(`${AUTH_BASE}/login`, {
    method: 'POST',
    body: { email, password },
  })
}

export function logoutHost(token: string): Promise<void> {
  return apiRequest<void>(`${AUTH_BASE}/logout`, { method: 'POST', token })
}

export function listSessions(token: string): Promise<Session[]> {
  return apiRequest<Session[]>(SESSIONS_BASE, { token })
}

export function createSession(token: string, name?: string): Promise<Session> {
  return apiRequest<Session>(SESSIONS_BASE, {
    method: 'POST',
    body: name !== undefined && name.trim() !== '' ? { name: name.trim() } : {},
    token,
  })
}

export function fetchSession(token: string, sessionId: string): Promise<Session> {
  return apiRequest<Session>(`${SESSIONS_BASE}/${sessionId}`, { token })
}

export function startSession(token: string, sessionId: string): Promise<Session> {
  return apiRequest<Session>(`${SESSIONS_BASE}/${sessionId}/start`, {
    method: 'POST',
    token,
  })
}

export function endSession(token: string, sessionId: string): Promise<Session> {
  return apiRequest<Session>(`${SESSIONS_BASE}/${sessionId}/end`, {
    method: 'POST',
    token,
  })
}

/** Fetch the session's join QR code (SVG source, decision D32). */
export function fetchSessionQr(token: string, sessionId: string): Promise<string> {
  return apiRequestText(`${SESSIONS_BASE}/${sessionId}/qr`, { token })
}
