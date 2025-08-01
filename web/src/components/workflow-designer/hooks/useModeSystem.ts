/**
 * Mode System React Hook
 * 
 * This hook integrates the mode system with React components and the existing
 * WorkflowContext, providing a clean interface for mode management within
 * the component hierarchy.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { 
  ModeDefinition, 
  ModeSystemEvent, 
  ModeSystemObserver,
  ModeRenderingStrategy 
} from '../types/mode-system'
import { getModeManager } from '../services/mode-manager'
import { RenderingStrategyFactory } from '../modes/rendering-strategies'
import { useWorkflowContext } from '../contexts/WorkflowContext'

/**
 * Hook return interface
 */
export interface UseModeSystemReturn {
  // Current state
  currentMode: ModeDefinition | null
  allModes: ModeDefinition[]
  isTransitioning: boolean
  
  // Mode operations
  switchMode: (modeId: string) => Promise<void>
  canSwitchToMode: (modeId: string) => boolean
  
  // Rendering strategy
  renderingStrategy: ModeRenderingStrategy | null
  
  // Theme utilities
  applyModeTheme: (element: HTMLElement | SVGElement) => void
  getModeCustomProperties: () => Record<string, string>
  
  // Event handling
  addEventListener: (callback: (event: ModeSystemEvent) => void) => () => void
  
  // Utility functions
  getModeById: (modeId: string) => ModeDefinition | null
  isCurrentMode: (modeId: string) => boolean
  
  // Performance utilities
  preloadMode: (modeId: string) => Promise<void>
  clearModeCache: () => void
}

/**
 * Mode system configuration for the hook
 */
export interface UseModeSystemConfig {
  enableTransitions?: boolean
  transitionDuration?: number
  enableCaching?: boolean
  autoApplyTheme?: boolean
  debugMode?: boolean
  onModeChange?: (mode: ModeDefinition) => void
  onTransitionStart?: (fromMode: ModeDefinition | null, toMode: ModeDefinition) => void
  onTransitionEnd?: (mode: ModeDefinition) => void
}

/**
 * Main mode system hook
 */
export const useModeSystem = (config: UseModeSystemConfig = {}): UseModeSystemReturn => {
  const {
    enableTransitions = true,
    transitionDuration = 400,
    enableCaching = true,
    autoApplyTheme = true,
    debugMode = false,
    onModeChange,
    onTransitionStart,
    onTransitionEnd
  } = config

  // Get workflow context for integration
  const { state, dispatch } = useWorkflowContext()
  
  // Mode manager instance
  const modeManager = useMemo(() => getModeManager({
    enableTransitions,
    transitionDuration,
    enableCaching,
    debugMode
  }), [enableTransitions, transitionDuration, enableCaching, debugMode])

  // Local state
  const [currentMode, setCurrentMode] = useState<ModeDefinition | null>(
    modeManager.getCurrentMode()
  )
  const [allModes, setAllModes] = useState<ModeDefinition[]>(
    modeManager.getAllModes()
  )
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [renderingStrategy, setRenderingStrategy] = useState<ModeRenderingStrategy | null>(null)

  // Refs for cleanup
  const eventListenersRef = useRef<Array<(event: ModeSystemEvent) => void>>([])
  const observerRef = useRef<ModeSystemObserver | null>(null)

  // Sync with workflow context designer mode
  useEffect(() => {
    const contextMode = state.designerMode
    const currentModeId = currentMode?.id
    
    if (contextMode !== currentModeId) {
      // Sync context with mode system
      if (currentModeId && (currentModeId === 'workflow' || currentModeId === 'architecture')) {
        dispatch({ type: 'SET_DESIGNER_MODE', payload: currentModeId as 'workflow' | 'architecture' })
      }
    }
  }, [currentMode, state.designerMode, dispatch])

  // Initialize mode system observer
  useEffect(() => {
    const observer: ModeSystemObserver = {
      onModeSystemEvent: (event: ModeSystemEvent) => {
        if (debugMode) {
          console.log('[useModeSystem] Mode system event:', event)
        }

        switch (event.type) {
          case 'MODE_SWITCH_STARTED':
            setIsTransitioning(true)
            const fromMode = event.fromModeId ? modeManager.getMode(event.fromModeId) : null
            const toMode = modeManager.getMode(event.toModeId)
            if (toMode && onTransitionStart) {
              onTransitionStart(fromMode, toMode)
            }
            break

          case 'MODE_SWITCH_COMPLETED':
            const newMode = modeManager.getMode(event.modeId)
            setCurrentMode(newMode)
            setIsTransitioning(false)
            
            // Update rendering strategy
            if (newMode) {
              try {
                const strategy = RenderingStrategyFactory.createStrategy(newMode.id)
                setRenderingStrategy(strategy)
              } catch (error) {
                console.warn(`[useModeSystem] No strategy for mode ${newMode.id}`)
                setRenderingStrategy(null)
              }
            }

            if (newMode && onModeChange) {
              onModeChange(newMode)
            }
            if (newMode && onTransitionEnd) {
              onTransitionEnd(newMode)
            }
            break

          case 'MODE_SWITCH_FAILED':
            setIsTransitioning(false)
            console.error(`[useModeSystem] Mode switch failed:`, event.error)
            break

          case 'MODE_REGISTERED':
            setAllModes(modeManager.getAllModes())
            break

          case 'MODE_UNREGISTERED':
            setAllModes(modeManager.getAllModes())
            break
        }

        // Notify event listeners
        eventListenersRef.current.forEach(callback => {
          try {
            callback(event)
          } catch (error) {
            console.error('[useModeSystem] Event listener error:', error)
          }
        })
      }
    }

    observerRef.current = observer
    modeManager.addObserver(observer)

    return () => {
      if (observerRef.current) {
        modeManager.removeObserver(observerRef.current)
      }
    }
  }, [modeManager, debugMode, onModeChange, onTransitionStart, onTransitionEnd])

  // Initialize rendering strategy
  useEffect(() => {
    if (currentMode) {
      try {
        const strategy = RenderingStrategyFactory.createStrategy(currentMode.id)
        setRenderingStrategy(strategy)
      } catch (error) {
        console.warn(`[useModeSystem] No strategy for mode ${currentMode.id}`)
        setRenderingStrategy(null)
      }
    }
  }, [currentMode])

  // Auto-apply theme when mode changes
  useEffect(() => {
    if (autoApplyTheme && currentMode) {
      applyGlobalTheme(currentMode)
    }
  }, [currentMode, autoApplyTheme])

  // Mode switching function
  const switchMode = useCallback(async (modeId: string): Promise<void> => {
    try {
      await modeManager.switchMode(modeId)
    } catch (error) {
      console.error('[useModeSystem] Switch mode error:', error)
      throw error
    }
  }, [modeManager])

  // Can switch to mode check
  const canSwitchToMode = useCallback((modeId: string): boolean => {
    return modeManager.canSwitchToMode(modeId)
  }, [modeManager])

  // Apply mode theme to specific element
  const applyModeTheme = useCallback((element: HTMLElement | SVGElement): void => {
    if (!currentMode) return

    const theme = currentMode.theme
    
    // Apply CSS custom properties
    Object.entries(theme.customProperties).forEach(([property, value]) => {
      element.style.setProperty(property, value)
    })

    // Apply CSS class
    element.classList.add(theme.cssClassName)

    // Apply canvas-specific styling if it's a canvas element
    if (element instanceof SVGSVGElement && renderingStrategy) {
      renderingStrategy.applyCanvasTransformations(element, theme.canvas)
    }
  }, [currentMode, renderingStrategy])

  // Get current mode custom properties
  const getModeCustomProperties = useCallback((): Record<string, string> => {
    return currentMode?.theme.customProperties || {}
  }, [currentMode])

  // Add event listener
  const addEventListener = useCallback((callback: (event: ModeSystemEvent) => void): (() => void) => {
    eventListenersRef.current.push(callback)
    
    // Return cleanup function
    return () => {
      const index = eventListenersRef.current.indexOf(callback)
      if (index > -1) {
        eventListenersRef.current.splice(index, 1)
      }
    }
  }, [])

  // Get mode by ID
  const getModeById = useCallback((modeId: string): ModeDefinition | null => {
    return modeManager.getMode(modeId)
  }, [modeManager])

  // Check if is current mode
  const isCurrentMode = useCallback((modeId: string): boolean => {
    return currentMode?.id === modeId
  }, [currentMode])

  // Preload mode (for performance)
  const preloadMode = useCallback(async (modeId: string): Promise<void> => {
    const mode = modeManager.getMode(modeId)
    if (mode) {
      try {
        // Preload rendering strategy
        RenderingStrategyFactory.createStrategy(modeId)
        
        // Preload any other resources
        if (debugMode) {
          console.log(`[useModeSystem] Preloaded mode: ${modeId}`)
        }
      } catch (error) {
        console.warn(`[useModeSystem] Failed to preload mode ${modeId}:`, error)
      }
    }
  }, [modeManager, debugMode])

  // Clear mode cache
  const clearModeCache = useCallback((): void => {
    // Implementation would clear any cached resources
    if (debugMode) {
      console.log('[useModeSystem] Mode cache cleared')
    }
  }, [debugMode])

  return {
    currentMode,
    allModes,
    isTransitioning,
    switchMode,
    canSwitchToMode,
    renderingStrategy,
    applyModeTheme,
    getModeCustomProperties,
    addEventListener,
    getModeById,
    isCurrentMode,
    preloadMode,
    clearModeCache
  }
}

/**
 * Apply global theme to document root
 */
const applyGlobalTheme = (mode: ModeDefinition): void => {
  const root = document.documentElement
  
  // Apply custom properties to root
  Object.entries(mode.theme.customProperties).forEach(([property, value]) => {
    root.style.setProperty(property, value)
  })

  // Apply mode class to body or canvas container
  const canvasContainer = document.querySelector('.canvas-container')
  if (canvasContainer) {
    // Remove existing mode classes
    canvasContainer.classList.remove('workflow-mode', 'architecture-mode', 'debug-mode')
    
    // Add new mode class
    canvasContainer.classList.add(mode.theme.cssClassName)
  }
}

/**
 * Lightweight hook for just getting current mode
 */
export const useCurrentMode = (): ModeDefinition | null => {
  const modeManager = getModeManager()
  const [currentMode, setCurrentMode] = useState<ModeDefinition | null>(
    modeManager.getCurrentMode()
  )

  useEffect(() => {
    const observer: ModeSystemObserver = {
      onModeSystemEvent: (event: ModeSystemEvent) => {
        if (event.type === 'MODE_SWITCH_COMPLETED') {
          setCurrentMode(modeManager.getMode(event.modeId))
        }
      }
    }

    modeManager.addObserver(observer)
    return () => modeManager.removeObserver(observer)
  }, [modeManager])

  return currentMode
}

/**
 * Hook for mode-specific behavior configuration
 */
export const useModeBehavior = () => {
  const { currentMode } = useModeSystem()
  
  return useMemo(() => ({
    behavior: currentMode?.behavior || null,
    canCreateNodes: currentMode?.behavior.allowNodeCreation ?? true,
    canDeleteNodes: currentMode?.behavior.allowNodeDeletion ?? true,
    canCreateConnections: currentMode?.behavior.allowConnectionCreation ?? true,
    canDeleteConnections: currentMode?.behavior.allowConnectionDeletion ?? true,
    enableDragAndDrop: currentMode?.behavior.enableDragAndDrop ?? true,
    enableMultiSelection: currentMode?.behavior.enableMultiSelection ?? true,
    autoLayout: currentMode?.behavior.autoLayout ?? false,
    snapToGrid: currentMode?.behavior.snapToGrid ?? false,
    showPortLabels: currentMode?.behavior.showPortLabels ?? false,
    showConnectionLabels: currentMode?.behavior.showConnectionLabels ?? false
  }), [currentMode])
}