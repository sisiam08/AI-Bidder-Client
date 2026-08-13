import type { ApprovedProposal, FillResult } from '../../lib/types'

const TEXTAREA_SELECTOR =
  'textarea#descriptionTextArea, fl-textarea[fltrackinglabel="ProposalDescriptionInput"] textarea, textarea[fltrackinglabel="ProposalDescriptionInput"]'

const AMOUNT_SELECTOR =
  'input#bidAmountInput, fl-input[fltrackinglabel="BidAmountInput"] input, input[fltrackinglabel="BidAmountInput"]'

const TIMELINE_SELECTOR =
  'input#periodInput, fl-input[fltrackinglabel="ProjectDeliveryInput"] input, input[fltrackinglabel="ProjectDeliveryInput"]'

export async function fillFreelancerProposal(
  data: ApprovedProposal,
): Promise<FillResult> {
  const filledFields: string[] = []
  console.log('[freelancer:fill] fillFreelancerProposal start', {
    platform: data.platform,
    externalJobId: data.externalJobId,
    proposalLen: (data.proposalText ?? '').length,
    budget: data.budget,
    timeline: data.timeline,
    path: location.pathname,
  })

  const restrictions = detectBidRestrictions()
  if (restrictions.length > 0) {
    console.log('[freelancer:fill] blocked by restrictions', restrictions)
    return {
      success: false,
      blocked: true,
      blockedReasons: restrictions,
      filledFields,
    }
  }

  const proposalText = (data.proposalText ?? '').trim()
  if (!proposalText) {
    return {
      success: false,
      blocked: true,
      blockedReasons: ['No proposal text was generated — nothing to fill'],
      filledFields,
    }
  }

  const budgetAmount = clampBidAmount(data)
  if (budgetAmount === null) {
    return {
      success: false,
      blocked: true,
      blockedReasons: ['No valid bid amount — cannot place a bid'],
      filledFields,
    }
  }

  const days = timelineToDays(data.timeline)
  if (days === null || days <= 0) {
    return {
      success: false,
      blocked: true,
      blockedReasons: ['No valid delivery timeline — cannot place a bid'],
      filledFields,
    }
  }

  const textareaAt = () =>
    document.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR)

  const form = await ensureBidForm(textareaAt)
  if (!form.open) {
    const lateRestrictions = detectBidRestrictions()
    if (lateRestrictions.length > 0) {
      return {
        success: false,
        blocked: true,
        blockedReasons: lateRestrictions,
        filledFields,
      }
    }
    if (form.navigated) {
      console.log('[freelancer:fill] bid entry navigated the page — returning error so the new page retries')
      return {
        success: false,
        error: 'Opening the bid form navigated the page — retrying on the new page',
        filledFields,
      }
    }
    console.log('[freelancer:fill] bid form never appeared')
    return {
      success: false,
      blocked: true,
      blockedReasons: [
        'The bid form is not available on this page — the project may be closed, awarded, or you may have already bid on it. Please open the bid form manually.',
      ],
      filledFields,
    }
  }

  const textarea = textareaAt()
  if (!textarea) {
    return { success: false, error: 'Bid textarea not found', filledFields }
  }
  setNativeValue(textarea, proposalText)
  highlight(textarea)
  filledFields.push('proposal')
  console.log('[freelancer:fill] proposal filled')

  const amountInput = document.querySelector<HTMLInputElement>(AMOUNT_SELECTOR)
  if (amountInput) {
    setNativeValue(amountInput, String(budgetAmount))
    highlight(amountInput)
    filledFields.push('budget')
    console.log('[freelancer:fill] amount filled:', budgetAmount)
  }

  const timelineInput = document.querySelector<HTMLInputElement>(TIMELINE_SELECTOR)
  if (timelineInput) {
    setNativeValue(timelineInput, String(days))
    highlight(timelineInput)
    filledFields.push('timeline')
    console.log('[freelancer:fill] timeline filled:', days)
  }

  await wait(300)

  const placed = clickPlaceBid()
  if (!placed) {
    console.log('[freelancer:fill] Place Bid button not found')
    return {
      success: false,
      error: 'Place Bid button not found',
      filledFields,
    }
  }
  console.log('[freelancer:fill] Place Bid clicked')
  return { success: true, filledFields: [...filledFields, 'placeBid'] }
}

async function ensureBidForm(
  find: () => HTMLTextAreaElement | null,
): Promise<{ open: boolean; reason?: string; navigated?: boolean }> {
  const delays = [500, 700, 900, 1200, 1500, 2000, 2500, 3000]
  let navigated = false
  for (let i = 0; i < delays.length; i++) {
    if (find()) {
      console.log('[freelancer:fill] bid form present')
      return { open: true, navigated }
    }
    const clicked = clickBidEntry()
    if (clicked?.isAnchor) navigated = true
    if (clicked) {
      console.log(`[freelancer:fill] clicked bid entry, waiting for form (navigated=${navigated})`)
      await wait(1500)
      if (find()) {
        console.log('[freelancer:fill] bid form present after clicking entry')
        return { open: true, navigated }
      }
    }
    await wait(delays[i])
  }
  return { open: false, navigated }
}

function clickBidEntry(): { isAnchor: boolean; target: string } | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href*="open-bid"], a[href*="open-bid-dialog"], a[href*="/bid"], button, a, fl-button button',
    ),
  )
  const entry = candidates.find((el) => {
    if (!isVisible(el)) return false
    const text = (el.textContent || '').trim().toLowerCase()
    const href = (el.getAttribute('href') || '').toLowerCase()
    return (
      href.includes('open-bid') ||
      /^(place\s+)?(a\s+)?bid\s*(now)?(\s|$)/.test(text) ||
      /^submit\s+(a\s+)?proposal(\s|$)/.test(text)
    )
  })
  if (!entry) return null
  const tag = entry.tagName.toLowerCase()
  const href = entry.getAttribute('href') || ''
  console.log(
    `[freelancer:fill] clickBidEntry <${tag}> href="${href}" text="${(entry.textContent || '').trim()}"`,
  )
  entry.click()
  return { isAnchor: tag === 'a', target: `${tag}:${href}` }
}

function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false
  const style = getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampBidAmount(data: ApprovedProposal): number | null {
  const raw = (data.budget as { amount?: number })?.amount
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  const client = (data.clientBudget ?? {}) as {
    max?: number
    min?: number
  }
  let amount = raw
  if (
    typeof client.max === 'number' &&
    Number.isFinite(client.max) &&
    client.max > 0 &&
    amount > client.max
  ) {
    amount = client.max
  }
  if (
    typeof client.min === 'number' &&
    Number.isFinite(client.min) &&
    client.min > 0 &&
    amount < client.min
  ) {
    amount = client.min
  }
  return Math.round(amount * 100) / 100
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  let inserted = false
  try {
    element.focus()
    element.select()
    inserted = document.execCommand('insertText', false, value)
  } catch {
    inserted = false
  }
  if (!inserted) {
    const proto = element.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
    descriptor?.set?.call(element, value)
  }
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value,
    }),
  )
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function timelineToDays(timeline?: string): number | null {
  if (!timeline) return null
  const match = timeline.match(
    /(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years)/i,
  )
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2].toLowerCase()
  const multiplier =
    unit.startsWith('week') ? 7
    : unit.startsWith('month') ? 30
    : unit.startsWith('year') ? 365
    : 1
  return Math.max(1, Math.round(value * multiplier))
}

const RESTRICTION_PATTERNS = [
  /no longer accepting (new )?bids?/i,
  /(project|job)( has)?( been)? closed/i,
  /(already|has been) awarded/i,
  /not accepting bids?/i,
  /bids? (are )?(now )?closed/i,
  /you can(not| no longer) bid/i,
  /project( has)? (been )?(archived|deleted|removed)/i,
  /position (has been )?filled/i,
  /project is no longer available/i,
]

function detectBidRestrictions(): string[] {
  const reasons: string[] = []
  const seen = new Set<string>()

  const push = (reason: string) => {
    const key = reason.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    reasons.push(reason)
  }

  document
    .querySelectorAll<HTMLElement>(
      'fl-banner-alert[data-type="warning"], fl-banner-alert[data-type="error"], fl-banner-alert[data-type="alert"]',
    )
    .forEach((banner) => {
      const title = banner.getAttribute('bannertitle') || ''
      const content = banner.querySelector('.Content, .Description')
      const description = (content?.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
      const reason = [title, description].filter(Boolean).join(' — ')
      push(reason || 'Bidding is restricted on this project')
    })

  if (
    document.querySelector(
      'fl-link[fltrackinglabel="ClientAgreementSigningLink"], a[fltrackinglabel="ClientAgreementSigningLink"]',
    )
  ) {
    push('Complete the required client agreement form before bidding')
  }

  const placeBid = document.querySelector<HTMLButtonElement>(
    'fl-button[fltrackinglabel="PlaceBidButton"] button, button[fltrackinglabel="PlaceBidButton"]',
  )
  if (placeBid && placeBid.disabled) {
    push('Place Bid button is disabled')
  }

  const bodyText = document.body?.innerText || ''
  for (const pattern of RESTRICTION_PATTERNS) {
    const match = bodyText.match(pattern)
    if (match) {
      push(match[0])
      break
    }
  }

  return reasons
}

function clickPlaceBid(): boolean {
  const button = document.querySelector<HTMLElement>(
    'fl-button[fltrackinglabel="PlaceBidButton"] button, button[fltrackinglabel="PlaceBidButton"]',
  )
  if (!button) return false
  console.log('[freelancer:fill] Place Bid button found, clicking')
  button.click()
  return true
}

function highlight(element: HTMLElement) {
  element.style.outline = '3px solid #2FB6A3'
  element.style.outlineOffset = '2px'
}