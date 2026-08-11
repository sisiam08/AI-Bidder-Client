import { toast, Toaster } from 'react-hot-toast'

export { Toaster }
export type ToastKind = 'info' | 'success' | 'error'

const colors: Record<ToastKind, string> = {
  info: '#3B82F6',
  success: '#2FB6A3',
  error: '#EF4444',
}

export function showToast(
  message: string,
  kind: ToastKind = 'info',
  duration = 4000,
): void {
  const options = {
    duration,
    style: { background: colors[kind], color: '#fff' },
    iconTheme: {
      primary: '#fff',
      secondary: 'rgba(255,255,255,0.35)',
    },
  }
  if (kind === 'success') toast.success(message, options)
  else if (kind === 'error') toast.error(message, options)
  else toast(message, options)
}
