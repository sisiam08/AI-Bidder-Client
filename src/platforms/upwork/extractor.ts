import type { ExtractedJob } from '../../lib/types'

function parseCurrency(value: string): number | undefined {
  const cleaned = value.replace(/[,$\s]/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : undefined
}

function parseUpworkCardBudget(text: string): Record<string, unknown> {
  const m = text.match(
    /(Hourly|Fixed-Price|Fixed)\s*:\s*\$?\s*([\d,.]+)\s*(?:[-–—]\s*\$?\s*([\d,.]+))?/i,
  )
  if (!m) return {}
  const type = /hourly/i.test(m[1]) ? 'hourly' : 'fixed'
  const min = parseCurrency(m[2])
  if (min === undefined) return {}
  const max = m[3] !== undefined ? parseCurrency(m[3]) : undefined
  const result: Record<string, unknown> = { type, min, currency: 'USD' }
  if (max !== undefined) result.max = max
  return result
}

function extractUpworkTimeline(text: string): string | undefined {
  const m = text.match(
    /(?:Project Length|Expected duration|Estimated duration|Duration|Timeline)\s*[:.-]?\s*([^\n]{2,50})/i,
  )
  return m?.[1]?.trim().replace(/[•·]/g, '').replace(/\s+/g, ' ') || undefined
}

function parseUpworkRelativeTime(text: string): string {
  const t = text.trim().toLowerCase()
  const now = Date.now()
  if (!t) return new Date().toISOString()
  if (/^today$/i.test(t)) return new Date().toISOString()
  if (/^yesterday$/i.test(t)) return new Date(now - 86400000).toISOString()
  const m = t.match(
    /(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?\s+ago/i,
  )
  if (!m) return new Date().toISOString()
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const mult: Record<string, number> = {
    min: 60000,
    minute: 60000,
    hour: 3600000,
    hr: 3600000,
    day: 86400000,
    week: 604800000,
    month: 2592000000,
    year: 31536000000,
  }
  return new Date(now - n * (mult[unit] ?? 0)).toISOString()
}

function extractUpworkCard(card: HTMLElement): ExtractedJob | null {
  const link = card.querySelector<HTMLAnchorElement>(
    'a[href^="/jobs/"]',
  )
  if (!link) return null
  const title = link.textContent?.trim() ?? ''
  if (!title) return null

  const href = (link.getAttribute('href') ?? '').split('?')[0]
  const externalJobId = href.replace(/\/+$/, '')
  if (!externalJobId) return null

  const descEl = card.querySelector<HTMLElement>(
    '[data-test="job-description-text"]',
  )
  let description = descEl?.textContent?.trim() ?? ''
  description = description.replace(/\s*more\s*$/i, '').trim()

  const budgetEl = card.querySelector<HTMLElement>('[data-test="job-type"]')
  const budget = parseUpworkCardBudget(budgetEl?.textContent?.trim() ?? '')

  const skills = Array.from(
    card.querySelectorAll<HTMLElement>('ul.air3-token-wrap a.air3-token'),
  )
    .map((e) => e.textContent?.trim() ?? '')
    .filter(Boolean)

  const clientInfo: Record<string, unknown> = {}

  const ratingText =
    card.querySelector<HTMLElement>('.air3-rating-background .sr-only')
      ?.textContent ?? ''
  const ratingMatch = ratingText.match(/Rating\s*is\s*([\d.]+)\s*out of\s*5/i)
  if (ratingMatch) {
    const r = Number(ratingMatch[1])
    if (Number.isFinite(r) && r >= 0 && r <= 5) clientInfo.rating = r
  }

  const paymentStatus = card.querySelector<HTMLElement>(
    '[data-test="payment-verification-status"]',
  )?.textContent
  if (paymentStatus) clientInfo.paymentVerified = true

  const spentEl = card.querySelector<HTMLElement>(
    '[data-test="formatted-amount"]',
  )
  const spent = parseCurrency(spentEl?.textContent?.trim() ?? '')
  if (spent !== undefined) clientInfo.spent = spent

  const country = card.querySelector<HTMLElement>(
    '[data-test="client-country"]',
  )?.textContent?.trim()
  if (country) clientInfo.country = country

  const proposals = card.querySelector<HTMLElement>(
    '[data-test="proposals-tier"]',
  )?.textContent?.trim()
  if (proposals) clientInfo.proposals = proposals

  const postedEl = card.querySelector<HTMLElement>(
    '[data-test="posted-on"]',
  )?.textContent?.trim()
  const postedAt = postedEl
    ? parseUpworkRelativeTime(postedEl)
    : new Date().toISOString()

  const timeline = extractUpworkTimeline(card.innerText)
  if (timeline) clientInfo.timeline = timeline

  return {
    platform: 'upwork',
    externalJobId,
    fingerprint: externalJobId,
    title,
    description,
    budget,
    skills,
    clientInfo,
    postedAt,
  }
}

export function extractUpworkJobs(): ExtractedJob[] {
  const cards = document.querySelectorAll<HTMLElement>(
    'section.air3-card-section, section[data-ev-sublocation="job_feed_tile"]',
  )
  const jobs: ExtractedJob[] = []
  const seen = new Set<string>()
  for (const card of cards) {
    const job = extractUpworkCard(card)
    if (job && !seen.has(job.externalJobId)) {
      seen.add(job.externalJobId)
      jobs.push(job)
    }
  }
  return jobs
}

function isHourlyBudget(text: string): boolean {
  return /per\s*hour|\/hr|per\s*hr|hourly/i.test(text)
}

function parseUpworkBudget(): Record<string, unknown> {
  const text = document.body?.innerText ?? ''
  const fixed = text.match(/Budget\s*[:$]?\s*\$([\d,.]+)\s*[-–—]\s*\$([\d,.]+)/)
  const hourly = text.match(/Hourly\s*[:$]?\s*\$([\d,.]+)\s*[-–—]\s*\$([\d,.]+)/)
  const single = text.match(/Budget\s*[:$]?\s*\$([\d,.]+)/)
  const hourlyBudget = isHourlyBudget(text)
  if (fixed) {
    const min = parseCurrency(fixed[1])
    const max = parseCurrency(fixed[2])
    if (min !== undefined && max !== undefined) {
      return { type: hourlyBudget ? 'hourly' : 'fixed', min, max, currency: 'USD' }
    }
  }
  if (hourly) {
    const min = parseCurrency(hourly[1])
    const max = parseCurrency(hourly[2])
    if (min !== undefined && max !== undefined) {
      return { type: 'hourly', min, max, currency: 'USD' }
    }
  }
  if (single) {
    const amount = parseCurrency(single[1])
    if (amount !== undefined) {
      return { type: hourlyBudget ? 'hourly' : 'fixed', min: amount, currency: 'USD' }
    }
  }
  return {}
}

function parseUpworkClientInfo(): Record<string, unknown> {
  const info: Record<string, unknown> = {}
  const nameEl = document.querySelector<HTMLAnchorElement>(
    'a[href*="client"][data-test], a[data-test="client-profile-link"]',
  )
  if (nameEl?.textContent?.trim()) {
    info.name = nameEl.textContent.trim()
  }
  const ratingText = document.body?.innerText ?? ''
  const ratingMatch = ratingText.match(/Rating\s*[:$]?\s*([\d.]+)\s*[\/out of ]*5/)
  if (ratingMatch) {
    const rating = Number(ratingMatch[1])
    if (Number.isFinite(rating) && rating > 0 && rating <= 5) {
      info.rating = rating
    }
  }
  const timeline = extractUpworkTimeline(document.body?.innerText ?? '')
  if (timeline) info.timeline = timeline
  return info
}

export function extractUpworkJob(): ExtractedJob | null {
  const titleEl = document.querySelector(
    'h2[data-test="job-title"], .job-title',
  )
  const descEl = document.querySelector(
    'div[data-test="description"], .job-description',
  )
  const jobIdMatch = location.pathname.match(/~([a-f0-9]+)/)

  if (!titleEl || !jobIdMatch) return null

  const skillEls = document.querySelectorAll(
    'a[data-test="skill"], .skills-section a',
  )

  const externalJobId = location.pathname.replace(/\/+$/, '')

  return {
    platform: 'upwork',
    externalJobId,
    fingerprint: location.href,
    title: titleEl.textContent?.trim() ?? '',
    description: descEl?.textContent?.trim() ?? '',
    budget: parseUpworkBudget(),
    skills: Array.from(skillEls).map((e) => e.textContent?.trim() ?? ''),
    clientInfo: parseUpworkClientInfo(),
    postedAt: new Date().toISOString(),
  }
}
