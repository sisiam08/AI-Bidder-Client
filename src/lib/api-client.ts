import type {
  AiAnalysis,
  ExtractedJob,
  Job,
  JobDetail,
  JobListParams,
  Proposal,
} from './types'
import { ApiError } from './types'
import { sessionTokenStorage } from './storage'

export const API_BASE_URL = 'http://localhost:5000/api'

export interface HealthStatus {
  status: string
  db: string
  timestamp: string
}

export interface ProposalResponse {
  job: JobDetail
  analysis: AiAnalysis | null
  proposal: Proposal | null
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await sessionTokenStorage.getValue()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new ApiError(res.status, text)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

function qs(params: Record<string, string | undefined>): string {
  const entries: [string, string][] = Object.entries(params).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && entry[1] !== '',
  )
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries).toString()
}

export interface SetupPayload {
  email: string
  aiProvider: string
  aiApiKey?: string
  telegramBotToken?: string
  telegramChatId?: string
}

export interface SetupResult {
  ok: boolean
  token: string
  user: { id: string; email: string }
}

export const api = {
  auth: {
    setup: async (payload: SetupPayload) => {
      const result = await request<SetupResult>('/v1/auth/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await sessionTokenStorage.setValue(result.token)
      return result
    },
    logout: async () => {
      try {
        return await request<{ ok: boolean }>('/v1/auth/logout', {
          method: 'POST',
        })
      } finally {
        await sessionTokenStorage.setValue(null)
      }
    },
  },
  jobs: {
    list: (params?: JobListParams) =>
      request<Job[]>(`/v1/jobs${qs(params as Record<string, string | undefined>)}`),
    create: (payload: ExtractedJob) =>
      request<Job>('/v1/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    get: (id: string) => request<JobDetail>(`/v1/jobs/${id}`),
    proposal: (id: string) => request<ProposalResponse>(`/v1/jobs/${id}/proposal`),
    approve: (id: string) =>
      request<void>(`/v1/jobs/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason?: string) =>
      request<void>(`/v1/jobs/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    submit: (id: string) =>
      request<void>(`/v1/jobs/${id}/submit`, { method: 'POST' }),
    markProposalFilled: (id: string) =>
      request<void>(`/v1/jobs/${id}/proposal/fill`, { method: 'POST' }),
    bidBlocked: (id: string, reasons: string[]) =>
      request<{ ok: boolean }>(`/v1/jobs/${id}/bid-blocked`, {
        method: 'POST',
        body: JSON.stringify({ reasons }),
      }),
  },
  health: {
    check: () => request<HealthStatus>('/v1/health'),
  },
}
