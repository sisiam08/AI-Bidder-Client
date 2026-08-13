import type { ApprovedProposal, FillResult } from '../../lib/types'

export function fillUpworkProposal(data: ApprovedProposal): FillResult {
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
    'textarea[data-test="proposal-text"], .proposal-textarea',
  )
  if (!textarea) {
    return { success: false, error: 'Proposal textarea not found' }
  }

  textarea.value = data.proposalText
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  highlight(textarea)
  filledFields.push('proposal')

  const budgetAmount = (data.budget as { amount?: number })?.amount
  if (typeof budgetAmount === 'number') {
    const budgetInput = document.querySelector<HTMLInputElement>(
      'input[data-test="budget-amount"], input[name="budget"], input[data-budget]',
    )
    if (budgetInput) {
      budgetInput.value = String(budgetAmount)
      budgetInput.dispatchEvent(new Event('input', { bubbles: true }))
      highlight(budgetInput)
      filledFields.push('budget')
    }
  }

  if (data.timeline) {
    const timelineInput = document.querySelector<HTMLInputElement>(
      'input[data-test="timeline"], input[name="duration"], input[name="delivery-time"]',
    )
    if (timelineInput) {
      timelineInput.value = data.timeline
      timelineInput.dispatchEvent(new Event('input', { bubbles: true }))
      highlight(timelineInput)
      filledFields.push('timeline')
    }
  }

  return { success: true, filledFields }
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

  const text = (document.body?.innerText || '')
    .replace(/\s+/g, ' ')
    .slice(0, 20000)

  const patterns: Array<[RegExp, string]> = [
    [/not enough connects|no available connects/i, 'Not enough Connects available to submit a proposal'],
    [/job is no longer accepting proposals|no longer accepting proposals/i, 'Job is no longer accepting proposals'],
    [/this job has been closed|job closed/i, 'This job has been closed'],
    [/only open to freelancers based in|this job is only visible/i, 'Job is restricted to certain freelancers or locations'],
    [/your account is suspended|account.*under review/i, 'Your Upwork account is suspended or under review'],
    [/identity verification|id verification/i, 'Identity verification required before submitting a proposal'],
    [/billing method.*required|payment method.*required/i, 'A billing method is required to submit a proposal'],
    [/you have been blocked|banned from/i, 'You have been blocked from submitting proposals'],
  ]

  for (const [pattern, message] of patterns) {
    if (pattern.test(text)) push(message)
  }

  const submit = document.querySelector<HTMLButtonElement>(
    'button[data-test="submit-proposal"], button[data-qa="submit-proposal"], button[type="submit"]',
  )
  if (submit && submit.disabled) {
    const label = (submit.textContent || '').trim()
    push(label ? `Submit button is disabled: ${label}` : 'Submit button is disabled')
  }

  return reasons
}

function highlight(element: HTMLElement) {
  element.style.outline = '3px solid #2FB6A3'
  element.style.outlineOffset = '2px'
}
