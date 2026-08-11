import type { ApprovedProposal, FillResult } from '../../lib/types'

export function fillUpworkProposal(data: ApprovedProposal): FillResult {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[data-test="proposal-text"], .proposal-textarea',
  )
  if (!textarea) {
    return { success: false, error: 'Proposal textarea not found' }
  }

  textarea.value = data.proposalText
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  highlight(textarea)

  const filledFields = ['proposal']

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

function highlight(element: HTMLElement) {
  element.style.outline = '3px solid #2FB6A3'
  element.style.outlineOffset = '2px'
}
