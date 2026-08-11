import { createRoot } from 'react-dom/client'
import { createIntegratedUi, type ContentScriptContext } from 'wxt/client'
import type { Root } from 'react-dom/client'
import { Toaster, showToast } from './toast'

interface QueuedToast {
  message: string
  kind: 'info' | 'success' | 'error'
  duration: number
}

let ready = false
const queue: QueuedToast[] = []

export function mountToastHost(ctx: ContentScriptContext): void {
  if (ready) return
  ready = true

  try {
    const ui = createIntegratedUi<Root>(ctx, {
      position: 'overlay',
      alignment: 'top-right',
      zIndex: 2147483647,
      onMount(wrapper) {
        const root = createRoot(wrapper)
        root.render(
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                maxWidth: '320px',
              },
            }}
          />,
        )
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })
    ui.mount()
  } catch (err) {
    console.error('[toast] failed to mount toast host:', err)
  }

  while (queue.length > 0) {
    const t = queue.shift()
    if (t) showToast(t.message, t.kind, t.duration)
  }
}
