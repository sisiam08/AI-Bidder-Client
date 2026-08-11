import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from './api-client'
import { sessionTokenStorage } from './storage'
import type { WsEvent } from './types'

let socket: Socket | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let listeners: Array<(event: WsEvent) => void> = []

function notifyListeners(event: WsEvent) {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      
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

export async function connect() {
  if (socket?.connected || socket?.active) {
    return
  }

  const wsOrigin = API_BASE_URL.replace(/\/api$/, '').replace(/^http/, 'ws')
  const url = `${wsOrigin}/v1/ws`
  const token = await sessionTokenStorage.getValue()

  socket = io(url, {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
    timeout: 10000,
  })

  socket.on('connect', () => {})
  socket.on('connect_error', (err) => {
    console.warn('[ws] connect_error:', err.message)
  })
  for (const event of WS_EVENTS) {
    socket.on(event, (data) => {
      const mapped = mapEvent(event, data)
      if (mapped) notifyListeners(mapped)
    })
  }
  socket.on('disconnect', (reason) => {
    console.warn('[ws] disconnected:', reason)
  })
}

export function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  listeners = []
  socket?.disconnect()
  socket = null
}
