import { useEffect, useCallback, useRef } from 'react'

export interface KeyboardShortcutConfig {
  // Modal controls
  onEscapePress?: () => void
  isModalOpen?: boolean

  // Navigation
  onArrowUp?: () => void
  onArrowDown?: () => void
  selectedHorseIndex?: number
  totalHorses?: number
  onHorseSelect?: (index: number) => void

  // Actions
  onSpacePress?: () => void // Toggle scratch
  onResetPress?: () => void // Ctrl+R reset
  hasChanges?: boolean

  // Modal control
  onEnterPress?: () => void // Open horse detail
}

export function useKeyboardShortcuts({
  onEscapePress,
  isModalOpen = false,
  onArrowUp,
  onArrowDown,
  selectedHorseIndex = -1,
  totalHorses = 0,
  onHorseSelect,
  onSpacePress,
  onResetPress,
  hasChanges = false,
  onEnterPress,
}: KeyboardShortcutConfig) {
  const showResetConfirmRef = useRef(false)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Get the active element
    const activeElement = document.activeElement
    const isInputFocused = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement

    // ESC key - close modal
    if (event.key === 'Escape') {
      if (showResetConfirmRef.current) {
        showResetConfirmRef.current = false
        return
      }
      if (isModalOpen && onEscapePress) {
        event.preventDefault()
        onEscapePress()
      }
      return
    }

    // Don't handle other shortcuts if input is focused
    if (isInputFocused) return

    // Arrow Up - navigate to previous horse
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (onArrowUp) {
        onArrowUp()
      } else if (onHorseSelect && totalHorses > 0) {
        const newIndex = selectedHorseIndex > 0 ? selectedHorseIndex - 1 : totalHorses - 1
        onHorseSelect(newIndex)
      }
      return
    }

    // Arrow Down - navigate to next horse
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (onArrowDown) {
        onArrowDown()
      } else if (onHorseSelect && totalHorses > 0) {
        const newIndex = selectedHorseIndex < totalHorses - 1 ? selectedHorseIndex + 1 : 0
        onHorseSelect(newIndex)
      }
      return
    }

    // Space - toggle scratch for selected horse
    if (event.key === ' ' || event.code === 'Space') {
      if (onSpacePress && selectedHorseIndex >= 0) {
        event.preventDefault()
        onSpacePress()
      }
      return
    }

    // Enter - open horse detail modal
    if (event.key === 'Enter') {
      if (onEnterPress && selectedHorseIndex >= 0 && !isModalOpen) {
        event.preventDefault()
        onEnterPress()
      }
      return
    }

    // Ctrl+R / Cmd+R - reset all (with confirmation)
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      if (onResetPress) {
        event.preventDefault()
        if (!hasChanges) {
          // No changes, just reset
          onResetPress()
        } else {
          // Show confirmation - this will be handled by the component
          showResetConfirmRef.current = true
          onResetPress()
        }
      }
      return
    }
  }, [
    isModalOpen,
    onEscapePress,
    onArrowUp,
    onArrowDown,
    selectedHorseIndex,
    totalHorses,
    onHorseSelect,
    onSpacePress,
    onResetPress,
    hasChanges,
    onEnterPress,
  ])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

// Hook for tracking selected horse in a race table
export function useHorseNavigation(totalHorses: number) {
  const [selectedIndex, setSelectedIndex] = useReducer(
    (state: number, action: { type: 'up' | 'down' | 'set'; payload?: number }) => {
      switch (action.type) {
        case 'up':
          return state > 0 ? state - 1 : totalHorses - 1
        case 'down':
          return state < totalHorses - 1 ? state + 1 : 0
        case 'set':
          return action.payload ?? state
        default:
          return state
      }
    },
    -1
  )

  const navigateUp = useCallback(() => setSelectedIndex({ type: 'up' }), [])
  const navigateDown = useCallback(() => setSelectedIndex({ type: 'down' }), [])
  const selectHorse = useCallback((index: number) => setSelectedIndex({ type: 'set', payload: index }), [])
  const clearSelection = useCallback(() => setSelectedIndex({ type: 'set', payload: -1 }), [])

  return {
    selectedIndex,
    navigateUp,
    navigateDown,
    selectHorse,
    clearSelection,
  }
}

// Need to import useReducer
import { useReducer } from 'react'

// Keyboard shortcut hints display
export interface ShortcutHint {
  keys: string[]
  description: string
}

export const KEYBOARD_SHORTCUTS: ShortcutHint[] = [
  { keys: ['Esc'], description: 'Close modal' },
  { keys: ['↑', '↓'], description: 'Navigate horses' },
  { keys: ['Space'], description: 'Toggle scratch' },
  { keys: ['Enter'], description: 'View horse details' },
  { keys: ['Ctrl', 'R'], description: 'Reset all changes' },
]
