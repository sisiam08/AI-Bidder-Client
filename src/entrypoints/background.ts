import { defineBackground } from 'wxt/sandbox'
import { api } from '../lib/api-client'
import { connect, onWsEvent, reconnect } from '../lib/ws-client'
import {
  detectSettingsStorage,
  pendingFillStorage,
  sessionTokenStorage,
  setupStorage,
  type DetectSettings,
} from '../lib/storage'
import type { ApprovedProposal, ExtractedJob, FillResult } from '../lib/types'
import type { SubmitResult } from '../lib/submit-job'
import { getProposalUrl } from '../platforms/registry'
import { parseFreelancerSlug } from '../platforms/freelancer/url'
import { browser } from 'wxt/browser'

export default defineBackground(() => {
  connect()
  void ensureSession()
  void reconnectWhenLoggedIn()

  browser.runtime.onMessage.addListener(
    (msg: unknown): Promise<SubmitResult | { status: string }> | undefined => {
      const m = msg as {
        type?: string
        job?: ExtractedJob
        jobId?: string
        reasons?: string[]
      }
      if (m?.type === 'CREATE_JOB' && m.job) {
        console.log('[background] CREATE_JOB received:', m.job.title)
        return api.jobs.create(m.job).then(
          (created) => {
            if (!created) {
              console.log('[background] CREATE_JOB duplicate (already on server)')
              return { status: 'duplicate' }
            }
            console.log('[background] CREATE_JOB created:', created.id)
            return { status: 'created', jobId: created.id }
          },
          (err) => {
            console.error('[background] CREATE_JOB failed:', err)
            return { status: 'error' }
          },
        )
      }
      if (m?.type === 'NOTIFY_BID_BLOCKED' && m.jobId) {
        console.log('[background] NOTIFY_BID_BLOCKED for job', m.jobId)
        return api.jobs
          .bidBlocked(m.jobId, m.reasons ?? [])
          .then(
            () => ({ status: 'sent' }),
            (err) => {
              console.error('[background] NOTIFY_BID_BLOCKED failed:', err)
              return { status: 'error' }
            },
          )
      }
      if (m?.type === 'MARK_PROPOSAL_FILLED' && m.jobId) {
        console.log('[background] MARK_PROPOSAL_FILLED for job', m.jobId)
        return api.jobs
          .markProposalFilled(m.jobId)
          .then(
            () => ({ status: 'sent' }),
            (err) => {
              console.error('[background] MARK_PROPOSAL_FILLED failed:', err)
              return { status: 'error' }
            },
          )
      }
      return undefined
    },
  )

  onWsEvent(async (event) => {
    broadcast(event.type, event.jobId)

    if (event.type !== 'job.approved') return
    const data = event.data as unknown as ApprovedProposal
    if (!data.proposalText) return

    await pendingFillStorage.setValue(data)

    const url = data.externalJobId
      ? getProposalUrl(data.platform || '', data.externalJobId)
      : null

    const tabs = await browser.tabs.query({})
    const exactTab = tabs.find(
      (tab) => typeof tab.id === 'number' && tab.url && matchesProposalTab(tab.url, data),
    )

    if (exactTab && typeof exactTab.id === 'number') {
      await browser.tabs.update(exactTab.id, { active: true })
      try {
        const result = (await browser.tabs.sendMessage(exactTab.id, {
          type: 'FILL_PROPOSAL',
          data,
        })) as FillResult | undefined
        if (result?.success || result?.blocked) {
          await pendingFillStorage.setValue(null)
          return
        }
      } catch {
        console.error('[background] could not send FILL_PROPOSAL message to tab:', exactTab.id)
      }
      if (url) {
        await browser.tabs.update(exactTab.id, { url })
      }
      return
    }

    if (url) {
      await browser.tabs.create({ url })
    }
  })

  void ensureDetectMenu()
  browser.contextMenus.onClicked.addListener(onDetectMenuClick)

  void syncAutoReloadAlarm()
  detectSettingsStorage.watch((settings) => {
    void syncAutoReloadAlarm(settings)
  })
  
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'auto-reload') {
      await reloadJobTabs()
      const s = await detectSettingsStorage.getValue()
      if (s?.mode === 'auto') {
        await scheduleNextReload(s.reloadMin, s.reloadMax)
      }
    }
  })
})

async function ensureSession() {
  const config = await setupStorage.getValue()
  if (!config) return
  const token = await sessionTokenStorage.getValue()
  if (token) return
  try {
    await api.auth.setup({ email: config.email, aiProvider: config.aiProvider })
    console.log('[background] restored missing session token')
    const settings = await detectSettingsStorage.getValue()
    if (settings?.mode !== 'auto') return
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) continue
      if (isPlatformTab(tab.url)) {
        browser.tabs.sendMessage(tab.id, { type: 'DETECT_JOBS' }).catch(() => {})
      }
    }
  } catch (err) {
    console.warn('[background] could not restore session token:', err)
  }
}

async function reconnectWhenLoggedIn() {
  await sessionTokenStorage.watch(async (token) => {
    if (token) {
      await reconnect()
    }
  })
}

async function syncAutoReloadAlarm(settings?: DetectSettings | null) {
  const s = settings ?? (await detectSettingsStorage.getValue())
  try {
    if (s?.mode === 'auto') {
      await scheduleNextReload(s.reloadMin, s.reloadMax)
    } else {
      await browser.alarms.clear('auto-reload')
    }
  } catch {
    
  }
}

function randomReloadDelay(min: number, max: number): number {
  if (!(min > 0) || !(max > min)) return 0
  const minutes = min + Math.random() * (max - min)
  return Math.round(minutes * 60) / 60
}

async function scheduleNextReload(min: number, max: number) {
  const delayMinutes = randomReloadDelay(min, max)
  if (delayMinutes <= 0) return
  await browser.alarms.create('auto-reload', { delayInMinutes: delayMinutes })
  console.log(`[background] next reload in ${delayMinutes} min`)
}

async function reloadJobTabs() {
  const tabs = await browser.tabs.query({})
  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || !tab.url) continue
    if (isPlatformTab(tab.url)) {
      browser.tabs.reload(tab.id).catch(() => {})
    }
  }
}

async function ensureDetectMenu() {
  try {
    await browser.contextMenus.removeAll()
  } catch {
    console.warn('[background] could not remove context menus')
  }
  browser.contextMenus.create({
    id: 'detect-jobs',
    title: 'Detect Jobs',
    contexts: ['page'],
    targetUrlPatterns: [
      '*://*.freelancer.com/*',
      '*://*.freelancer.com.bd/*',
      '*://*.upwork.com/*',
    ],
  })
}

async function onDetectMenuClick(
  info: { menuItemId: string | number },
  tab?: { id?: number; url?: string },
) {
  if (info.menuItemId !== 'detect-jobs') return
  const tabId = tab?.id
  if (typeof tabId !== 'number') return

  const token = await sessionTokenStorage.getValue()
  if (!token) {
    browser.tabs.sendMessage(tabId, { type: 'NO_SESSION' }).catch(() => {})
    return
  }

  try {
    await browser.tabs.sendMessage(tabId, { type: 'DETECT_JOBS' })
  } catch {
    const file = tab?.url?.includes('upwork.com')
      ? 'content-scripts/upwork.js'
      : 'content-scripts/freelancer.js'
    try {
      await browser.scripting.executeScript({ target: { tabId }, files: [file] })
      await browser.tabs.sendMessage(tabId, { type: 'DETECT_JOBS' })
    } catch {
      console.error('[background] could not inject content script into tab:', tabId)
    }
  }
}

async function broadcast(type: string, jobId?: string) {
  const tabs = await browser.tabs.query({})
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue
    browser.tabs
      .sendMessage(tab.id, { type: 'WS_EVENT', event: type, jobId })
      .catch(() => {})
  }
}

function isPlatformTab(url: string, platform?: string): boolean {
  if (platform === 'upwork') {
    return /^https:\/\/(www\.)?upwork\.com\//.test(url)
  }
  if (platform === 'freelancer') {
    return /^https:\/\/(www\.)?freelancer\.com\//.test(url)
  }
  return (
    /^https:\/\/(www\.)?freelancer\.com(\.[a-z]{2})?\//.test(url) ||
    /^https:\/\/(www\.)?upwork\.com\//.test(url)
  )
}

function matchesProposalTab(url: string, data: ApprovedProposal): boolean {
  const externalJobId = data.externalJobId || ''
  const path = url.split('?')[0].split('#')[0].replace(/\/+$/, '')
  if (path === externalJobId || path.startsWith(externalJobId)) return true
  if (/upwork\.com/.test(url)) {
    const targetId = externalJobId.match(/~([a-f0-9]+)/)?.[1]
    const currentId = path.match(/~([a-f0-9]+)/)?.[1]
    return !!targetId && targetId === currentId
  }
  if (/freelancer\.com/.test(url)) {
    const targetSlug = parseFreelancerSlug(externalJobId)
    const currentSlug = parseFreelancerSlug(path)
    return !!targetSlug && targetSlug === currentSlug
  }
  return false
}
