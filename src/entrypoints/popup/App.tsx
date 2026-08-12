import { useEffect, useState } from 'react'
import { api } from '../../lib/api-client'
import { ApiError } from '../../lib/types'
import {
  detectSettingsStorage,
  sessionTokenStorage,
  setupStorage,
  DEFAULT_RELOAD_MIN,
  DEFAULT_RELOAD_MAX,
} from '../../lib/storage'
import { showToast } from '../../lib/toast'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'
import { cn } from '../../lib/utils'

const providerOptions = ['ollama', 'openrouter']

function parseReloadValue(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

export default function PopupApp() {
  const [email, setEmail] = useState('')
  const [aiProvider, setAiProvider] = useState('openrouter')
  const [aiApiKey, setAiApiKey] = useState('')
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')

  const [configured, setConfigured] = useState(false)
  const [mode, setMode] = useState<'view' | 'update' | 'create'>('create')
  const [saving, setSaving] = useState(false)

  const [detectMode, setDetectMode] = useState<'auto' | 'manual'>('auto')
  const [reloadMin, setReloadMin] = useState(String(DEFAULT_RELOAD_MIN))
  const [reloadMax, setReloadMax] = useState(String(DEFAULT_RELOAD_MAX))

  useEffect(() => {
    void restore()
  }, [])

  async function restore() {
    const config = await setupStorage.getValue()
    if (config) {
      setConfigured(true)
      setMode('view')
      setEmail(config.email)
      setAiProvider(config.aiProvider)
      await ensureSession(config)
    } else {
      setConfigured(false)
      setMode('create')
    }
    const ds = await detectSettingsStorage.getValue()
    setDetectMode(ds.mode)
    setReloadMin(String(ds.reloadMin))
    setReloadMax(String(ds.reloadMax))
  }

  async function ensureSession(config: { email: string; aiProvider: string }) {
    const token = await sessionTokenStorage.getValue()
    if (token) return
    try {
      await api.auth.setup({
        email: config.email,
        aiProvider: config.aiProvider,
      })
      console.log('[popup] restored missing session token')
    } catch (err) {
      console.warn('[popup] could not restore session token:', err)
    }
  }

  async function saveDetectSettings() {
    const min = parseReloadValue(reloadMin)
    const max = parseReloadValue(reloadMax)
    if (!(min > 0) || !(max > min)) {
      showToast('Min must be less than max', 'error')
      return
    }
    await detectSettingsStorage.setValue({
      mode: detectMode,
      reloadMin: min,
      reloadMax: max,
    })
    showToast('Detection settings saved', 'success')
  }

  const reloadMinParsed = parseReloadValue(reloadMin)
  const reloadMaxParsed = parseReloadValue(reloadMax)
  const reloadMinEntered = reloadMin.trim() !== ''
  const reloadMaxEntered = reloadMax.trim() !== ''
  const isValidReloadRange =
    reloadMinEntered &&
    reloadMaxEntered &&
    reloadMinParsed > 0 &&
    reloadMaxParsed > reloadMinParsed

  const locked = configured && mode === 'view'
  const emailLocked = locked || mode === 'update'

  function describeError(err: unknown): string {
    if (err instanceof ApiError) {
      const detail = err.message.trim()
      return detail
        ? `Setup failed (${err.status}). ${detail}`
        : `Setup failed (${err.status}).`
    }
    if (err instanceof TypeError) {
      return 'Could not connect to the backend server. Make sure it is running.'
    }
    return 'Setup failed. Please try again.'
  }

  async function save() {
    if (!email.trim()) {
      showToast('Email is required', 'error')
      return
    }

    setSaving(true)
    try {
      await api.auth.setup({
        email: email.trim(),
        aiProvider,
        aiApiKey: aiApiKey || undefined,
        telegramBotToken: telegramBotToken || undefined,
        telegramChatId: telegramChatId || undefined,
      })

      await setupStorage.setValue({ email: email.trim(), aiProvider })
      setConfigured(true)
      setMode('view')
      showToast('Configuration saved', 'success')
    } catch (err) {
      showToast(describeError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function startUpdate() {
    const config = await setupStorage.getValue()
    if (config) {
      setEmail(config.email)
      setAiProvider(config.aiProvider)
    }
    setMode('update')
  }

  function startCreate() {
    setEmail('')
    setAiApiKey('')
    setTelegramBotToken('')
    setTelegramChatId('')
    setAiProvider('openrouter')
    setMode('create')
  }

  async function cancel() {
    if (!configured) {
      setMode('create')
      return
    }
    const config = await setupStorage.getValue()
    if (config) {
      setEmail(config.email)
      setAiProvider(config.aiProvider)
    }
    setMode('view')
  }

  return (
    <div className="flex w-[360px] flex-col gap-4 bg-transparent p-4">
      <header>
        <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
          Agentic
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {configured
            ? 'Configuration saved. Everything else runs automatically.'
            : 'One-time setup: connect your AI provider and Telegram bot.'}
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={emailLocked || saving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider">AI Provider</Label>
              <Select
                value={aiProvider}
                onValueChange={setAiProvider}
                disabled={locked || saving}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apiKey">AI API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                disabled={locked || saving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="botToken">Telegram Bot Token</Label>
              <Input
                id="botToken"
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                disabled={locked || saving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chatId">Telegram Chat ID</Label>
              <Input
                id="chatId"
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="123456789"
                disabled={locked || saving}
              />
            </div>

            {mode !== 'view' && (
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            )}

            {mode !== 'view' && configured && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void cancel()}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div>
            <h2 className="font-heading text-sm font-bold tracking-tight text-foreground">
              Job Detection
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Auto reloads the job page and detects jobs on every load. Manual
              detects via the right-click menu only.
            </p>
          </div>

          <RadioGroup
            value={detectMode}
            onValueChange={(v) => setDetectMode(v as 'auto' | 'manual')}
            className="flex gap-4"
          >
            <Label
              htmlFor="detect-auto"
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium text-muted-foreground',
                detectMode === 'auto' && 'text-foreground',
              )}
            >
              <RadioGroupItem value="auto" id="detect-auto" />
              Auto
            </Label>
            <Label
              htmlFor="detect-manual"
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium text-muted-foreground',
                detectMode === 'manual' && 'text-foreground',
              )}
            >
              <RadioGroupItem value="manual" id="detect-manual" />
              Manual (context menu)
            </Label>
          </RadioGroup>

          {detectMode === 'auto' && (
            <div className="flex flex-col gap-2">
              <Label>Reload interval (minutes)</Label>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={reloadMin}
                    onChange={(e) => setReloadMin(e.target.value)}
                    placeholder="Min"
                    aria-label="Minimum minutes"
                  />
                </div>
                <span className="text-xs text-muted-foreground">to</span>
                <div className="flex flex-1 flex-col gap-1">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={reloadMax}
                    onChange={(e) => setReloadMax(e.target.value)}
                    placeholder="Max"
                    aria-label="Maximum minutes"
                  />
                </div>
              </div>
              {isValidReloadRange && (
                <p className="text-xs text-muted-foreground">
                  The tab reloads at a random time between {reloadMinParsed}{' '}
                  and {reloadMaxParsed} minutes.
                </p>
              )}
              {reloadMinEntered &&
                reloadMaxEntered &&
                !isValidReloadRange && (
                  <p className="text-xs text-destructive">
                    Max must be greater than min (e.g. 5 to 10 minutes).
                  </p>
                )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => void saveDetectSettings()}>Save</Button>
          </div>
        </CardContent>
      </Card>

      {configured && mode === 'view' && (
        <footer className="flex items-center justify-between border-t pt-3">
          <Button
            variant="link"
            onClick={() => void startUpdate()}
          >
            Update Info
          </Button>
          <Button variant="link" onClick={startCreate}>
            Create New
          </Button>
        </footer>
      )}
    </div>
  )
}
