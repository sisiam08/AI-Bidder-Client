import { storage } from 'wxt/storage'
import type { ApprovedProposal } from './types'

export interface SetupConfig {
  email: string
  aiProvider: string
}

export const DEFAULT_RELOAD_MIN = 5
export const DEFAULT_RELOAD_MAX = 10

export interface DetectSettings {
  mode: 'auto' | 'manual'
  reloadMin: number
  reloadMax: number
}

export const detectSettingsStorage = storage.defineItem<DetectSettings>(
  'local:detectSettings',
  {
    defaultValue: {
      mode: 'auto',
      reloadMin: DEFAULT_RELOAD_MIN,
      reloadMax: DEFAULT_RELOAD_MAX,
    },
  },
)

export const setupStorage = storage.defineItem<SetupConfig | null>(
  'local:setupConfig',
  { defaultValue: null },
)

export const sessionTokenStorage = storage.defineItem<string | null>(
  'local:sessionToken',
  { defaultValue: null },
)

export const seenFingerprints = storage.defineItem<string[]>(
  'local:seenFingerprints',
  { defaultValue: [] },
)

export const pendingFillStorage = storage.defineItem<ApprovedProposal | null>(
  'local:pendingFill',
  { defaultValue: null },
)
