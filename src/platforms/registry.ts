import type { PlatformAdapter } from './platform.interface'
import { upworkAdapter } from './upwork/index'
import { freelancerAdapter } from './freelancer/index'

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
    case 'freelancer': {
      const base = externalJobId.startsWith('/')
        ? externalJobId
        : `/projects/${externalJobId}`
      const trimmed = base.replace(/\/+$/, '')
      const path = trimmed.endsWith('/bid')
        ? trimmed
        : `${trimmed}/bid`
      return `https://www.freelancer.com${path}`
    }
    default:
      return null
  }
}
