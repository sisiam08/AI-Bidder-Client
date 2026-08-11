import type { ExtractedJob, FillResult, ApprovedProposal } from '../lib/types'

export interface PlatformAdapter {
  name: string
  urlPattern: RegExp
  detect(): boolean
  extractJob(): ExtractedJob | null
  extractJobs(): ExtractedJob[]
  fillProposal(data: ApprovedProposal): FillResult
  getFormFields(): Record<string, HTMLElement | null>
}
