import { useEffect, useCallback } from 'react'

type KeyHandler = (event: KeyboardEvent) => void

interface HotkeyOptions {
  enabled?: boolean
  preventDefault?: boolean
  enableOnFormTags?: boolean
}

const formTags = ['input', 'textarea', 'select']

export function useHotkeys(
  keys: string,
  callback: KeyHandler,
  options: HotkeyOptions = {}
) {
  const {
    enabled = true,
    preventDefault = true,
    enableOnFormTags = false
  } = options

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) {return}

    // Check if we're in a form element
    const target = event.target as HTMLElement
    if (!enableOnFormTags && formTags.includes(target.tagName.toLowerCase())) {
      return
    }

    // Parse the key combination
    const keyCombos = keys.split(',').map(combo => combo.trim().toLowerCase())
    
    for (const combo of keyCombos) {
      const parts = combo.split('+').map(part => part.trim())
      let isMatch = true

      for (const part of parts) {
        switch (part) {
          case 'cmd':
          case 'command':
          case 'meta':
            if (!event.metaKey) {isMatch = false}
            break
          case 'ctrl':
          case 'control':
            if (!event.ctrlKey) {isMatch = false}
            break
          case 'alt':
          case 'option':
            if (!event.altKey) {isMatch = false}
            break
          case 'shift':
            if (!event.shiftKey) {isMatch = false}
            break
          case 'space':
            if (event.key !== ' ') {isMatch = false}
            break
          case 'enter':
          case 'return':
            if (event.key !== 'Enter') {isMatch = false}
            break
          case 'escape':
          case 'esc':
            if (event.key !== 'Escape') {isMatch = false}
            break
          case 'delete':
          case 'del':
            if (event.key !== 'Delete') {isMatch = false}
            break
          case 'backspace':
            if (event.key !== 'Backspace') {isMatch = false}
            break
          case 'tab':
            if (event.key !== 'Tab') {isMatch = false}
            break
          case 'up':
          case 'arrowup':
            if (event.key !== 'ArrowUp') {isMatch = false}
            break
          case 'down':
          case 'arrowdown':
            if (event.key !== 'ArrowDown') {isMatch = false}
            break
          case 'left':
          case 'arrowleft':
            if (event.key !== 'ArrowLeft') {isMatch = false}
            break
          case 'right':
          case 'arrowright':
            if (event.key !== 'ArrowRight') {isMatch = false}
            break
          default:
            // Single character or function keys
            if (part.startsWith('f') && part.length <= 3) {
              // Function keys F1-F12
              if (event.key.toLowerCase() !== part) {isMatch = false}
            } else if (event.key.toLowerCase() !== part) {
              isMatch = false
            }
        }
      }

      if (isMatch) {
        if (preventDefault) {
          event.preventDefault()
        }
        callback(event)
        break
      }
    }
  }, [keys, callback, enabled, preventDefault, enableOnFormTags])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

// Export additional helper hooks
export function useKey(key: string, callback: KeyHandler, options?: HotkeyOptions) {
  return useHotkeys(key, callback, options)
}

export function useCtrlKey(key: string, callback: KeyHandler, options?: HotkeyOptions) {
  return useHotkeys(`ctrl+${key}`, callback, options)
}

export function useCmdKey(key: string, callback: KeyHandler, options?: HotkeyOptions) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return useHotkeys(`${isMac ? 'cmd' : 'ctrl'}+${key}`, callback, options)
}
