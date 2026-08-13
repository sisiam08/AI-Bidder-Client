import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from './api-client'
import { sessionTokenStorage } from './storage'
import type { WsEvent } from './types'

let socket: Socket | null = null
let connecting: Promise<void> | null = null
let listeners: Array<(event: WsEvent) => void> = []

function notifyListeners(event: WsEvent) {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      console.error('[ws] listener error:', event)
    }
  }
}

export function onWsEvent(cb: (event: WsEvent) => void) {
  listeners.push(cb)
  return () => {
    listeners = listeners.filter((l) => l !== cb)
  }
}

const WS_EVENTS = [
  'job.analyzed',
  'job.approved',
  'job.rejected',
  'job.failed',
  'job.submitted',
] as const

function mapEvent(event: string, data: unknown): WsEvent | null {
  if (!(WS_EVENTS as readonly string[]).includes(event)) {
    return null
  }
  const payload = (data ?? {}) as { jobId?: string }
  return {
    type: event as WsEvent['type'],
    jobId: payload.jobId ?? '',
    data: data as Record<string, unknown>,
  }
}

function wsUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, '')
  return `${base.replace(/^http/, 'ws')}/ws`
}

export function connect(): Promise<void> {
  if (connecting) return connecting
  connecting = openSocket().finally(() => {
    connecting = null
  })
  return connecting
}

export async function reconnect(): Promise<void> {
  const prev = socket
  socket = null
  connecting = null
  if (prev) {
    prev.removeAllListeners()
    prev.disconnect()
  }
  await connect()
}

async function openSocket(): Promise<void> {
  const url = wsUrl()
  const token = await sessionTokenStorage.getValue()

  const s = io(url, {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
    timeout: 10000,
  })
  socket = s
  attachHandlers(s, url)

  await new Promise<void>((resolve) => {
    if (s.connected) {
      resolve()
      return
    }
    s.once('connect', () => resolve())
    s.once('connect_error', () => resolve())
  })
}

function attachHandlers(s: Socket, url: string) {
  s.on('connect', () => {
    console.log('[ws] connected to', url)
  })
  s.on('connect_error', (err) => {
    console.warn('[ws] connect_error:', err.message)
  })
  for (const event of WS_EVENTS) {
    s.on(event, (data) => {
      const mapped = mapEvent(event, data)
      if (mapped) notifyListeners(mapped)
    })
  }
  s.on('disconnect', (reason) => {
    console.warn('[ws] disconnected:', reason)
  })
}

export function disconnect() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
  listeners = []
}