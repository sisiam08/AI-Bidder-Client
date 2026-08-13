import type { ExtractedJob } from '../../lib/types'

function parseCurrency(value: string): number | undefined {
  const cleaned = value.replace(/[,$\s]/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : undefined
}

function hashText(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = (h * 33) ^ text.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

function parseRelativeTime(text: string): string {
  const m = text.match(
    /(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?\s+ago/i,
  )
  if (!m) return new Date().toISOString()
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const now = Date.now()
  const multipliers: Record<string, number> = {
    min: 60000,
    minute: 60000,
    hour: 3600000,
    hr: 3600000,
    day: 86400000,
    week: 604800000,
    month: 2592000000,
    year: 31536000000,
  }
  return new Date(now - n * (multipliers[unit] ?? 0)).toISOString()
}

function isHourlyBudget(text: string): boolean {
  return /per\s*hour|\/hr|per\s*hr|hourly/i.test(text)
}

function parseCardBudget(text: string): Record<string, unknown> {
  const m = text.match(
    /([₹$€£])\s*([\d,.]+)\s*(?:[-–—to]+\s*[₹$€£]?\s*([\d,.]+))?\s*(INR|USD|EUR|GBP|AUD|CAD)?/i,
  )
  if (!m) return {}
  const min = parseCurrency(m[2])
  const max = m[3] ? parseCurrency(m[3]) : undefined
  const trailing = m[4]?.toUpperCase()
  const symbol = m[1]
  const currency =
    trailing ?? (symbol === '₹' ? 'INR' : symbol === '€' ? 'EUR' : symbol === '£' ? 'GBP' : 'USD')
  const result: Record<string, unknown> = {
    type: isHourlyBudget(text) ? 'hourly' : 'fixed',
    min,
    currency,
  }
  if (max !== undefined) result.max = max
  return result
}

function extractCard(card: HTMLElement): ExtractedJob | null {
  const titleEl = card.querySelector<HTMLElement>('.Title, .Title-text')
  const title = titleEl?.textContent?.trim() ?? ''
  if (!title) return null

  const readMore = card.querySelector<HTMLElement>(
    '.ReadMoreButton, .ReadMoreText',
  )
  const descEl =
    readMore?.parentElement ??
    card.querySelector<HTMLElement>('p[class*="mb-xxsmall"]')
  let description = descEl?.textContent?.trim() ?? ''
  description = description.replace(/\s*more\s*$/i, '').trim()

  const budgetEl = card.querySelector<HTMLElement>('.BudgetTooltip')
  const budget = parseCardBudget(budgetEl?.textContent?.trim() ?? '')

  const skills = Array.from(
    new Set(
      Array.from(card.querySelectorAll<HTMLElement>('.SkillsWrapper-skill'))
        .map((e) => e.textContent?.trim() ?? '')
        .filter(Boolean),
    ),
  )

  const ratingEl = card.querySelector<HTMLElement>('.ClientRating')
  let rating: number | undefined
  const ratingAttr = ratingEl?.getAttribute('data-rating')
  if (ratingAttr) {
    const r = Number(ratingAttr)
    if (Number.isFinite(r) && r >= 0 && r <= 5) rating = r
  }
  if (rating === undefined) {
    const layer = card.querySelector<HTMLElement>('[aria-label^="Rating:"]')
    const attrMatch = layer?.getAttribute('aria-label')?.match(/Rating:\s*([\d.]+)/)
    if (attrMatch) {
      const r = Number(attrMatch[1])
      if (Number.isFinite(r) && r >= 0 && r <= 5) rating = r
    }
  }
  if (rating === undefined) {
    const valueBlock = card.querySelector<HTMLElement>('.ValueBlock')
    const r = Number(valueBlock?.textContent?.trim())
    if (Number.isFinite(r) && r >= 0 && r <= 5) rating = r
  }

  const clientInfo: Record<string, unknown> = {}
  if (rating !== undefined) clientInfo.rating = rating

  const allText = card.innerText
  const bidsMatch = allText.match(/(\d+)\s*bids?/i)
  if (bidsMatch) clientInfo.bids = Number(bidsMatch[1])

  const timeMatch = allText.match(
    /\d+\s*(?:minute|min|hour|hr|day|week|month|year)s?\s+ago/i,
  )
  const postedAt = timeMatch
    ? parseRelativeTime(timeMatch[0])
    : new Date().toISOString()

  const href =
    card.closest<HTMLAnchorElement>('a[href]')?.getAttribute('href') ?? ''
  let externalJobId: string
  let fingerprint: string
  if (href) {
    externalJobId = href
    fingerprint = href
  } else {
    const idText = `${title}|${budgetEl?.textContent?.trim() ?? ''}|${timeMatch?.[0] ?? ''}`
    externalJobId = hashText(idText)
    fingerprint = externalJobId
  }

  return {
    platform: 'freelancer',
    externalJobId,
    fingerprint,
    title,
    description,
    budget,
    skills,
    clientInfo,
    postedAt,
  }
}

function parseSearchCardPrice(text: string): Record<string, unknown> {
  const m = text
    .trim()
    .match(/^([₹$€£]?)\s*([\d,.]+)\s*(?:[-–—]\s*[₹$€£]?\s*([\d,.]+))?(?:\s*(?:INR|USD|EUR|GBP|AUD|CAD))?(?:\s*(?:\/|per)\s*hr(?:s)?)?/i)
  if (!m) return {}
  const min = parseCurrency(m[2])
  if (min === undefined) return {}
  const max = m[3] ? parseCurrency(m[3]) : undefined
  const hourly = isHourlyBudget(text)
  const currency = m[1] === '₹' ? 'INR' : m[1] === '€' ? 'EUR' : m[1] === '£' ? 'GBP' : 'USD'
  const result: Record<string, unknown> = { type: hourly ? 'hourly' : 'fixed', min, currency }
  if (max !== undefined) result.max = max
  return result
}

function extractSearchCard(card: HTMLElement): ExtractedJob | null {
  const link = card.querySelector<HTMLAnchorElement>(
    'a.JobSearchCard-primary-heading-link[href]',
  )
  if (!link) return null
  const title = link.textContent?.trim() ?? ''
  if (!title) return null

  const href = (link.getAttribute('href') ?? '').split('?')[0]
  if (!href) return null

  const descEl = card.querySelector<HTMLElement>(
    '.JobSearchCard-primary-description',
  )
  let description = descEl?.textContent?.trim() ?? ''
  description = description.replace(/\s*more\s*$/i, '').trim()

  const priceEl = card.querySelector<HTMLElement>(
    '.JobSearchCard-secondary-price, .JobSearchCard-primary-price',
  )
  const budget = parseSearchCardPrice(priceEl?.textContent?.trim() ?? '')

  const skills = Array.from(
    card.querySelectorAll<HTMLElement>('a.JobSearchCard-primary-tagsLink'),
  )
    .map((e) => e.textContent?.trim() ?? '')
    .filter(Boolean)

  const clientInfo: Record<string, unknown> = {}
  const bidsEl = card.querySelector<HTMLElement>(
    '.JobSearchCard-secondary-entry',
  )
  const bidsMatch = bidsEl?.textContent?.match(/(\d+)\s*bids?/i)
  if (bidsMatch) clientInfo.bids = Number(bidsMatch[1])

  return {
    platform: 'freelancer',
    externalJobId: href,
    fingerprint: href,
    title,
    description,
    budget,
    skills,
    clientInfo,
    postedAt: new Date().toISOString(),
  }
}

export async function expandCardDescriptions(): Promise<void> {
  const cards = document.querySelectorAll<HTMLElement>(
    'fl-project-contest-card, .fl-project-contest-card',
  )
  let changed = false
  for (const card of cards) {
    const btn = card.querySelector<HTMLElement>(
      'button.ReadMoreButton, .ReadMoreButton',
    )
    if (btn) {
      btn.click()
      changed = true
    }
  }
  if (!changed) return
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 100)
  })
}

export function extractFreelancerJobs(): ExtractedJob[] {
  const cards = document.querySelectorAll<HTMLElement>(
    'fl-project-contest-card, .fl-project-contest-card, .JobSearchCard-item',
  )
  const jobs: ExtractedJob[] = []
  for (const card of cards) {
    const isSearchCard = card.classList.contains('JobSearchCard-item')
    const job = isSearchCard ? extractSearchCard(card) : extractCard(card)
    if (job) jobs.push(job)
  }
  return jobs
}

function parseFreelancerBudget(): Record<string, unknown> {
  const text = document.body?.innerText ?? ''
  const range = text.match(/Budget\s*[:$]?\s*\$?([\d,.]+)\s*[-–—]\s*\$?([\d,.]+)/)
  const single = text.match(/Budget\s*[:$]?\s*\$?([\d,.]+)/)
  const hourly = text.match(/Hourly\s*[:$]?\s*\$?([\d,.]+)\s*[-–—]\s*\$?([\d,.]+)/)
  const hourlyBudget = isHourlyBudget(text)
  if (hourly) {
    const min = parseCurrency(hourly[1])
    const max = parseCurrency(hourly[2])
    if (min !== undefined && max !== undefined) {
      return { type: 'hourly', min, max, currency: 'USD' }
    }
  }
  if (range) {
    const min = parseCurrency(range[1])
    const max = parseCurrency(range[2])
    if (min !== undefined && max !== undefined) {
      return { type: hourlyBudget ? 'hourly' : 'fixed', min, max, currency: 'USD' }
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

function parseFreelancerClientInfo(): Record<string, unknown> {
  const info: Record<string, unknown> = {}
  const nameEl = document.querySelector<HTMLAnchorElement>(
    'a[href*="users/"], .PageProjectViewLogedIn-client .username',
  )
  if (nameEl?.textContent?.trim()) {
    info.name = nameEl.textContent.trim()
  }
  const text = document.body?.innerText ?? ''
  const ratingMatch = text.match(/(?:Client|User)\s*(?:Rating\s*)?[:*$]?\s*([\d.]+)\s*\/\s*5/)
  if (ratingMatch) {
    const rating = Number(ratingMatch[1])
    if (Number.isFinite(rating) && rating > 0 && rating <= 5) {
      info.rating = rating
    }
  }
  return info
}

export function extractFreelancerJob(): ExtractedJob | null {
  const titleEl = document.querySelector(
    'h1[class*="project-title"], .PageProjectViewLogedIn-header-title',
  )
  const descEl = document.querySelector(
    'div[class*="description"], .PageProjectViewLogedIn-description',
  )
  const jobIdMatch = location.pathname.match(/^\/projects\/(.+?)(?:\/(?:details|bid))?$/)

  if (!titleEl || !jobIdMatch) return null

  const skillEls = document.querySelectorAll('a[class*="Skill"], .Skill')

  return {
    platform: 'freelancer',
    externalJobId: jobIdMatch[1],
    fingerprint: location.href,
    title: titleEl.textContent?.trim() ?? '',
    description: descEl?.textContent?.trim() ?? '',
    budget: parseFreelancerBudget(),
    skills: Array.from(skillEls).map((e) => e.textContent?.trim() ?? ''),
    clientInfo: parseFreelancerClientInfo(),
    postedAt: new Date().toISOString(),
  }
}
