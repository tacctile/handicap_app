import { memo, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ToastMessage {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'critical'
  duration?: number
  persistent?: boolean
  icon?: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
  position?: 'top-right' | 'bottom-center'
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

const TOAST_ICONS: Record<ToastMessage['type'], string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  critical: 'error',
}

export const Toast = memo(function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const duration = toast.persistent ? null : (toast.duration ?? 4000)
  const icon = toast.icon || TOAST_ICONS[toast.type]

  useEffect(() => {
    if (duration === null) return

    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, duration - 300)

    const dismissTimer = setTimeout(() => {
      onDismiss(toast.id)
    }, duration)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(dismissTimer)
    }
  }, [duration, onDismiss, toast.id])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  return (
    <motion.div
      className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      role="alert"
      aria-live={toast.type === 'critical' ? 'assertive' : 'polite'}
    >
      <Icon name={icon} className="toast-icon" />
      <span className="toast-message">{toast.message}</span>

      {toast.action && (
        <button className="toast-action" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}

      <button
        className="toast-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <Icon name="close" className="toast-dismiss-icon" />
      </button>
    </motion.div>
  )
})

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  position?: 'top-right' | 'bottom-center'
}

export const ToastContainer = memo(function ToastContainer({
  toasts,
  onDismiss,
  position = 'top-right',
}: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className={`toast-container toast-container-${position}`}>
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} position={position} />
        ))}
      </AnimatePresence>
    </div>
  )
})

// Enhanced hook for managing toasts with post time notification support
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((
    message: string,
    type: ToastMessage['type'] = 'info',
    options?: {
      duration?: number
      persistent?: boolean
      icon?: string
      action?: { label: string; onClick: () => void }
    }
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: ToastMessage = {
      id,
      message,
      type,
      duration: options?.duration,
      persistent: options?.persistent,
      icon: options?.icon,
      action: options?.action,
    }
    setToasts(prev => [...prev, newToast])
    return id
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  // Add post time notification toast
  const addPostTimeNotification = useCallback((
    minutesMark: number,
    raceNumber?: number
  ) => {
    const isUrgent = minutesMark <= 5
    const isCritical = minutesMark <= 2

    let message: string
    let type: ToastMessage['type']
    let icon: string

    if (isCritical) {
      message = raceNumber
        ? `Race ${raceNumber} starts in ${minutesMark} minute${minutesMark === 1 ? '' : 's'}! Place bets now!`
        : `Race starts in ${minutesMark} minute${minutesMark === 1 ? '' : 's'}! Place bets now!`
      type = 'critical'
      icon = 'sports_score'
    } else if (isUrgent) {
      message = raceNumber
        ? `Race ${raceNumber}: ${minutesMark} minutes until post time`
        : `${minutesMark} minutes until post time`
      type = 'warning'
      icon = 'timer'
    } else {
      message = raceNumber
        ? `Race ${raceNumber}: ${minutesMark} minutes until post time`
        : `${minutesMark} minutes until post time`
      type = 'info'
      icon = 'schedule'
    }

    return addToast(message, type, {
      duration: isCritical ? 8000 : isUrgent ? 6000 : 4000,
      persistent: isCritical,
      icon,
    })
  }, [addToast])

  return {
    toasts,
    addToast,
    dismissToast,
    clearAll,
    addPostTimeNotification,
  }
}

// Mobile-aware toast container that positions based on viewport
export const ResponsiveToastContainer = memo(function ResponsiveToastContainer({
  toasts,
  onDismiss,
}: Omit<ToastContainerProps, 'position'>) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className={`toast-container ${isMobile ? 'toast-container-bottom-center' : 'toast-container-top-right'}`}>
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            position={isMobile ? 'bottom-center' : 'top-right'}
          />
        ))}
      </AnimatePresence>
    </div>
  )
})
