import { seenFingerprints } from './storage'
import type { ExtractedJob } from './types'
import { browser } from 'wxt/browser'

export type SubmitResult =
  | { status: 'created'; jobId: string }
  | { status: 'duplicate' }
  | { status: 'error' }

export async function submitDetectedJob(
  job: ExtractedJob,
): Promise<SubmitResult> {
  const seen = await seenFingerprints.getValue()
  if (seen.includes(job.fingerprint)) return { status: 'duplicate' }

  try {
    console.log('[submit] sending CREATE_JOB for', job.title)
    const { fingerprint: _fingerprint, ...payload } = job
    const result = (await browser.runtime.sendMessage({
      type: 'CREATE_JOB',
      job: payload,
    })) as SubmitResult
    console.log('[submit] CREATE_JOB response:', result.status)
    if (result.status === 'duplicate') {
      return { status: 'duplicate' }
    }
    if (result.status === 'error') {
      return { status: 'error' }
    }
    seen.push(job.fingerprint)
    await seenFingerprints.setValue(seen.slice(-200))
    return { status: 'created', jobId: result.jobId }
  } catch (err) {
    console.error('[submit] CREATE_JOB error:', err)
    return { status: 'error' }
  }
}
