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

export const API_BASE_URL = 'http://localhost:5000/api/v1'

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
      const result = await request<SetupResult>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await sessionTokenStorage.setValue(result.token)
      return result
    },
    logout: async () => {
      try {
        return await request<{ ok: boolean }>('/auth/logout', {
          method: 'POST',
        })
      } finally {
        await sessionTokenStorage.setValue(null)
      }
    },
  },
  jobs: {
    list: (params?: JobListParams) =>
      request<Job[]>(`/jobs${qs(params as Record<string, string | undefined>)}`),
    create: (payload: ExtractedJob) =>
      request<Job>('/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    get: (id: string) => request<JobDetail>(`/jobs/${id}`),
    proposal: (id: string) => request<ProposalResponse>(`/jobs/${id}/proposal`),
    approve: (id: string) =>
      request<void>(`/jobs/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason?: string) =>
      request<void>(`/jobs/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    submit: (id: string) =>
      request<void>(`/jobs/${id}/submit`, { method: 'POST' }),
    markProposalFilled: (id: string) =>
      request<void>(`/jobs/${id}/proposal/fill`, { method: 'POST' }),
    bidBlocked: (id: string, reasons: string[]) =>
      request<{ ok: boolean }>(`/jobs/${id}/bid-blocked`, {
        method: 'POST',
        body: JSON.stringify({ reasons }),
      }),
  },
  health: {
    check: () => request<HealthStatus>('/health'),
  },
}
