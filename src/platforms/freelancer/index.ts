import type { PlatformAdapter } from '../platform.interface'
import { isFreelancerJobPage, isFreelancerBidPage, hasFreelancerCards } from './detector'
import { extractFreelancerJob, extractFreelancerJobs } from './extractor'
import { fillFreelancerProposal } from './form-filler'

export const freelancerAdapter: PlatformAdapter = {
  name: 'freelancer',
  urlPattern: /^https:\/\/(www\.)?freelancer\.com(\.[a-z]{2})?\//,  detect: () => isFreelancerJobPage() || isFreelancerBidPage() || hasFreelancerCards(),
  extractJob: extractFreelancerJob,
  extractJobs: extractFreelancerJobs,
  fillProposal: fillFreelancerProposal,
  getFormFields: () => ({
    textarea: document.querySelector<HTMLTextAreaElement>(
      'textarea#descriptionTextArea, fl-textarea[fltrackinglabel="ProposalDescriptionInput"] textarea',
    ),
    amount: document.querySelector<HTMLInputElement>(
      'input#bidAmountInput, fl-input[fltrackinglabel="BidAmountInput"] input',
    ),
    timeline: document.querySelector<HTMLInputElement>(
      'input#periodInput, fl-input[fltrackinglabel="ProjectDeliveryInput"] input',
    ),
  }),
}
