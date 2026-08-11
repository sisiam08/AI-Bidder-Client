import type { PlatformAdapter } from '../platform.interface'
import { isUpworkJobPage, isUpworkProposalPage, hasUpworkCards } from './detector'
import { extractUpworkJob, extractUpworkJobs } from './extractor'
import { fillUpworkProposal } from './form-filler'

export const upworkAdapter: PlatformAdapter = {
  name: 'upwork',
  urlPattern: /^https:\/\/(www\.)?upwork\.com\//,  detect: () => isUpworkJobPage() || isUpworkProposalPage() || hasUpworkCards(),
  extractJob: extractUpworkJob,
  extractJobs: extractUpworkJobs,
  fillProposal: fillUpworkProposal,
  getFormFields: () => ({
    textarea: document.querySelector<HTMLTextAreaElement>(
      'textarea[data-test="proposal-text"]',
    ),
  }),
}
