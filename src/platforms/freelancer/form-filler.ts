import type { ApprovedProposal, FillResult } from '../../lib/types'

export function fillFreelancerProposal(data: ApprovedProposal): FillResult {
  const restrictions = detectBidRestrictions()
  const filledFields: string[] = []

  if (restrictions.length > 0) {
    return {
      success: false,
      blocked: true,
      blockedReasons: restrictions,
      filledFields,
    }
  }

  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea#descriptionTextArea, fl-textarea[fltrackinglabel="ProposalDescriptionInput"] textarea, textarea[fltrackinglabel="ProposalDescriptionInput"]',
  )
  if (!textarea) {
    return { success: false, error: 'Bid textarea not found' }
  }

  setNativeValue(textarea, data.proposalText)
  highlight(textarea)
  filledFields.push('proposal')

  const budgetAmount = (data.budget as { amount?: number })?.amount
  if (typeof budgetAmount === 'number') {
    const amountInput = document.querySelector<HTMLInputElement>(
      'input#bidAmountInput, fl-input[fltrackinglabel="BidAmountInput"] input, input[fltrackinglabel="BidAmountInput"]',
    )
    if (amountInput) {
      setNativeValue(amountInput, String(budgetAmount))
      highlight(amountInput)
      filledFields.push('budget')
    }
  }

  const days = timelineToDays(data.timeline)
  if (days !== null) {
    const timelineInput = document.querySelector<HTMLInputElement>(
      'input#periodInput, fl-input[fltrackinglabel="ProjectDeliveryInput"] input, input[fltrackinglabel="ProjectDeliveryInput"]',
    )
    if (timelineInput) {
      setNativeValue(timelineInput, String(days))
      highlight(timelineInput)
      filledFields.push('timeline')
    }
  }

  const placed = clickPlaceBid()
  if (!placed) {
    return {
      success: false,
      error: 'Place Bid button not found',
      filledFields,
    }
  }

  return { success: true, filledFields: [...filledFields, 'placeBid'] }
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const proto = element.tagName === 'TEXTAREA'
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
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

  return reasons
}

function clickPlaceBid(): boolean {
  const button = document.querySelector<HTMLElement>(
    'fl-button[fltrackinglabel="PlaceBidButton"] button, button[fltrackinglabel="PlaceBidButton"]',
  )
  if (!button) return false
  button.click()
  return true
}

function highlight(element: HTMLElement) {
  element.style.outline = '3px solid #2FB6A3'
  element.style.outlineOffset = '2px'
}
