/**
 * Mode System - Main Entry Point
 * 
 * This file exports all public interfaces and implementations of the mode system,
 * providing a clean API for consumers while maintaining internal modularity.
 */

// Core types and interfaces
export type {
  ModeIdentifier,
  ConnectionTheme,
  PortTheme,
  CanvasTheme,
  NodeTheme,
  ModeTheme,
  ModeBehavior,
  ModeTransition,
  ModeDefinition,
  ModeRenderingStrategy,
  ModeFactory,
  ModeManager,
  ModeSystemEvent,
  ModeSystemObserver,
  ModeSystemContext,
  ModeSystemConfig
} from '../types/mode-system'

// Pre-built mode definitions
export {
  WORKFLOW_MODE,
  ARCHITECTURE_MODE,
  DEBUG_MODE,
  ALL_MODES,
  MODES_BY_ID,
  getDefaultMode,
  isValidModeId,
  getModesByCategory
} from './mode-definitions'

// Rendering strategies
export {
  WorkflowRenderingStrategy,
  ArchitectureRenderingStrategy,
  DebugRenderingStrategy,
  RenderingStrategyFactory
} from './rendering-strategies'

// Factory implementation
export {
  ModeFactory,
  modeFactory,
  createWorkflowMode,
  createArchitectureMode,
  createDebugMode,
  createCustomMode
} from './mode-factory'

// Mode manager service
export {
  ModeManager,
  getModeManager,
  resetModeManager
} from '../services/mode-manager'

// React hooks
export {
  useModeSystem,
  useCurrentMode,
  useModeBehavior
} from '../hooks/useModeSystem'

export type {
  UseModeSystemReturn,
  UseModeSystemConfig
} from '../hooks/useModeSystem'

/**
 * Quick start utilities for common use cases
 */
export class ModeSystemUtils {
  /**
   * Initialize the mode system with default configuration
   */
  static initialize(config?: Partial<ModeSystemConfig>) {
    return getModeManager(config)
  }

  /**
   * Create a simple custom mode based on an existing mode
   */
  static createSimpleCustomMode(
    baseModeId: string,
    customName: string,
    themeOverrides?: Partial<ModeTheme>
  ): ModeDefinition {
    return modeFactory.cloneMode(baseModeId, {
      id: `custom-${baseModeId}-${Date.now()}`,
      name: customName,
      theme: themeOverrides
    })
  }

  /**
   * Apply a mode's theme to any element
   */
  static applyThemeToElement(
    element: HTMLElement | SVGElement,
    mode: ModeDefinition
  ): void {
    Object.entries(mode.theme.customProperties).forEach(([property, value]) => {
      element.style.setProperty(property, value)
    })
    element.classList.add(mode.theme.cssClassName)
  }

  /**
   * Get theme colors for external use
   */
  static getThemeColors(mode: ModeDefinition) {
    const theme = mode.theme
    return {
      primary: theme.customProperties['--mode-primary-color'] || '#2563eb',
      secondary: theme.customProperties['--mode-secondary-color'] || '#059669',
      background: theme.customProperties['--mode-background'] || '#ffffff',
      text: theme.customProperties['--mode-text-color'] || '#1e293b',
      border: theme.customProperties['--mode-border-color'] || '#e2e8f0'
    }
  }

  /**
   * Validate mode compatibility with existing workflow
   */
  static validateModeCompatibility(
    mode: ModeDefinition,
    workflowData: { nodes: unknown[]; connections: unknown[] }
  ): { compatible: boolean; warnings: string[] } {
    const warnings: string[] = []
    let compatible = true

    // Check if mode supports required features
    if (workflowData.nodes.length > 0 && !mode.behavior.allowNodeCreation) {
      warnings.push('Mode does not support node creation')
    }

    if (workflowData.connections.length > 0 && !mode.behavior.allowConnectionCreation) {
      warnings.push('Mode does not support connection creation')
    }

    // Add more validation rules as needed
    return { compatible, warnings }
  }

  /**
   * Get performance metrics for mode system
   */
  static getPerformanceMetrics() {
    const manager = getModeManager()
    return {
      registeredModes: manager.getAllModes().length,
      currentMode: manager.getCurrentMode()?.id || 'none',
      // Add more metrics as needed
    }
  }
}

/**
 * Event emitter for mode system global events
 */
export class ModeSystemEventBus {
  private static listeners = new Map<string, Array<(data: unknown) => void>>()

  static on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  static emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[ModeSystemEventBus] Error in ${event} listener:`, error)
        }
      })
    }
  }

  static off(event: string): void {
    this.listeners.delete(event)
  }

  static clear(): void {
    this.listeners.clear()
  }
}

/**
 * Default export for convenience
 */
const ModeSystem = {
  // Utilities
  Utils: ModeSystemUtils,
  EventBus: ModeSystemEventBus,
  
  // Core services
  getModeManager,
  modeFactory,
  
  // Built-in modes
  modes: {
    WORKFLOW_MODE,
    ARCHITECTURE_MODE,
    DEBUG_MODE
  },
  
  // Strategies
  RenderingStrategyFactory
}

export default ModeSystem