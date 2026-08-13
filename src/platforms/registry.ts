import type { PlatformAdapter } from './platform.interface'
import { upworkAdapter } from './upwork/index'
import { freelancerAdapter } from './freelancer/index'
import { freelancerProjectUrl } from './freelancer/url'

const adapters: PlatformAdapter[] = [upworkAdapter, freelancerAdapter]

export function getActiveAdapter(): PlatformAdapter | null {
  return adapters.find((a) => a.detect()) ?? null
}

export function getAllAdapters(): PlatformAdapter[] {
  return adapters
}

export function getProposalUrl(
  platform: string,
  externalJobId: string,
): string | null {
  switch (platform) {
    case 'upwork': {
      const idMatch = externalJobId.match(/~([a-f0-9]+)/)
      const id = idMatch?.[1] ?? externalJobId
      return `https://www.upwork.com/ab/proposals/apply/~${id}`
    }
    case 'freelancer':
      return freelancerProjectUrl(externalJobId)
    default:
      return null
  }
}
