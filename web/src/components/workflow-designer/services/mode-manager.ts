/**
 * Mode Manager Service - Centralized Mode Management
 * 
 * This service implements the Observer pattern and provides a centralized
 * management system for mode switching, validation, and event notification.
 * Follows SOLID principles with clear separation of concerns.
 */

import type { 
  ModeManager as IModeManager,
  ModeDefinition,
  ModeSystemEvent,
  ModeSystemObserver,
  ModeSystemContext,
  ModeSystemConfig
} from '../types/mode-system'

import { modeFactory } from '../modes/mode-factory'
import { RenderingStrategyFactory } from '../modes/rendering-strategies'
import { WORKFLOW_MODE, ARCHITECTURE_MODE, DEBUG_MODE } from '../modes/mode-definitions'

/**
 * Mode transition state management
 */
interface TransitionState {
  isTransitioning: boolean
  fromModeId: string | null
  toModeId: string | null
  startTime: number
  duration: number
}

/**
 * Mode manager implementation with Observer pattern
 * Single Responsibility: Manages mode lifecycle and transitions
 */
export class ModeManager implements IModeManager {
  private readonly modes = new Map<string, ModeDefinition>()
  private readonly observers: ModeSystemObserver[] = []
  private currentModeId: string | null = null
  private transitionState: TransitionState = {
    isTransitioning: false,
    fromModeId: null,
    toModeId: null,
    startTime: 0,
    duration: 0
  }
  private readonly config: ModeSystemConfig
  private readonly modeCache = new Map<string, { mode: ModeDefinition; lastAccessed: number }>()

  constructor(config: Partial<ModeSystemConfig> = {}) {
    this.config = {
      enableTransitions: true,
      transitionDuration: 400,
      enableValidation: true,
      enableCaching: true,
      maxCacheSize: 50,
      debugMode: false,
      defaultModeId: 'workflow',
      ...config
    }

    this.initializeBuiltInModes()
    this.setCurrentMode(this.config.defaultModeId)
  }

  /**
   * Registers a new mode definition
   * Open/Closed Principle: Open for extension via new modes
   */
  registerMode(mode: ModeDefinition): void {
    try {
      if (this.config.enableValidation) {
        this.validateModeForRegistration(mode)
      }

      this.modes.set(mode.id, mode)
      
      if (this.config.enableCaching) {
        this.updateCache(mode.id, mode)
      }

      this.notifyObservers({
        type: 'MODE_REGISTERED',
        modeId: mode.id
      })

      if (this.config.debugMode) {
        console.log(`[ModeManager] Registered mode: ${mode.id}`)
      }
    } catch (error) {
      console.error(`[ModeManager] Failed to register mode ${mode.id}:`, error)
      throw error
    }
  }

  /**
   * Unregisters a mode definition
   */
  unregisterMode(modeId: string): void {
    if (!this.modes.has(modeId)) {
      throw new Error(`Mode '${modeId}' is not registered`)
    }

    if (this.currentModeId === modeId) {
      throw new Error(`Cannot unregister currently active mode '${modeId}'`)
    }

    this.modes.delete(modeId)
    this.modeCache.delete(modeId)

    this.notifyObservers({
      type: 'MODE_UNREGISTERED',
      modeId
    })

    if (this.config.debugMode) {
      console.log(`[ModeManager] Unregistered mode: ${modeId}`)
    }
  }

  /**
   * Gets a mode definition by ID
   * Implements caching for performance
   */
  getMode(modeId: string): ModeDefinition | null {
    if (this.config.enableCaching) {
      const cached = this.modeCache.get(modeId)
      if (cached) {
        cached.lastAccessed = Date.now()
        return cached.mode
      }
    }

    const mode = this.modes.get(modeId) || null
    
    if (mode && this.config.enableCaching) {
      this.updateCache(modeId, mode)
    }

    return mode
  }

  /**
   * Lists all registered modes
   */
  getAllModes(): ModeDefinition[] {
  return Array.from(this.modes.values()).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  }

  /**
   * Gets the currently active mode
   */
  getCurrentMode(): ModeDefinition | null {
    return this.currentModeId ? this.getMode(this.currentModeId) : null
  }

  /**
   * Switches to a different mode with transition animation
   * Template Method: Defines mode switching algorithm
   */
  async switchMode(modeId: string): Promise<void> {
    if (!this.canSwitchToMode(modeId)) {
      throw new Error(`Cannot switch to mode '${modeId}'`)
    }

    if (this.currentModeId === modeId) {
      if (this.config.debugMode) {
        console.log(`[ModeManager] Already in mode: ${modeId}`)
      }
      return
    }

    const fromModeId = this.currentModeId
    const toMode = this.getMode(modeId)
    
    if (!toMode) {
      throw new Error(`Mode '${modeId}' not found`)
    }

    try {
      await this.performModeSwitch(fromModeId, modeId, toMode)
    } catch (error) {
      this.notifyObservers({
        type: 'MODE_SWITCH_FAILED',
        modeId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Validates if a mode switch is possible
   * Interface Segregation: Separate validation from execution
   */
  canSwitchToMode(modeId: string): boolean {
    // Check if mode exists
    if (!this.modes.has(modeId)) {
      return false
    }

    // Check if already transitioning
    if (this.transitionState.isTransitioning) {
      return false
    }

    // Check mode dependencies
    const mode = this.getMode(modeId)
    if (mode?.dependencies) {
      const hasAllDependencies = mode.dependencies.every(depId => this.modes.has(depId))
      if (!hasAllDependencies) {
        return false
      }
    }

    return true
  }

  /**
   * Adds a mode system observer
   * Observer Pattern: Loose coupling between manager and observers
   */
  addObserver(observer: ModeSystemObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer)
    }
  }

  /**
   * Removes a mode system observer
   */
  removeObserver(observer: ModeSystemObserver): void {
    const index = this.observers.indexOf(observer)
    if (index > -1) {
      this.observers.splice(index, 1)
    }
  }

  /**
   * Creates a mode system context for dependency injection
   * Dependency Inversion: High-level modules don't depend on low-level modules
   */
  createContext(): ModeSystemContext {
    return {
      modeManager: this,
      modeFactory,
      currentMode: this.getCurrentMode(),
      isTransitioning: this.transitionState.isTransitioning,
      observers: [...this.observers]
    }
  }

  /**
   * Gets mode switching history for analytics
   */
  getModeHistory(): Array<{ modeId: string; timestamp: number; duration?: number }> {
    // Implementation would track mode switches
    return []
  }

  /**
   * Bulk mode operations for efficiency
   */
  bulkRegisterModes(modes: ModeDefinition[]): void {
    const errors: Array<{ modeId: string; error: string }> = []
    
    modes.forEach(mode => {
      try {
        this.registerMode(mode)
      } catch (error) {
        errors.push({
          modeId: mode.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })

    if (errors.length > 0 && this.config.debugMode) {
      console.warn('[ModeManager] Bulk registration errors:', errors)
    }
  }

  /**
   * Memory management and cleanup
   */
  cleanup(): void {
    this.modeCache.clear()
    this.observers.length = 0
    this.transitionState = {
      isTransitioning: false,
      fromModeId: null,
      toModeId: null,
      startTime: 0,
      duration: 0
    }
  }

  // Private implementation methods

  private initializeBuiltInModes(): void {
    [WORKFLOW_MODE, ARCHITECTURE_MODE, DEBUG_MODE].forEach(mode => {
      this.modes.set(mode.id, mode)
    })
  }

  private setCurrentMode(modeId: string): void {
    if (this.modes.has(modeId)) {
      this.currentModeId = modeId
    } else {
  console.warn(`[ModeManager] Mode '${modeId}' not found, using workflow`)
  this.currentModeId = 'workflow'
    }
  }

  private async performModeSwitch(
    fromModeId: string | null, 
    toModeId: string, 
    toMode: ModeDefinition
  ): Promise<void> {
    // Start transition
    this.transitionState = {
      isTransitioning: true,
      fromModeId,
      toModeId,
      startTime: Date.now(),
  duration: this.config.enableTransitions ? (toMode.transition?.duration ?? 0) : 0
    }

    this.notifyObservers({
      type: 'MODE_SWITCH_STARTED',
      fromModeId: fromModeId || '',
      toModeId
    })

    try {
      // Apply mode changes
      await this.applyModeChanges(toMode)
      
      // Wait for transition if enabled
      if (this.config.enableTransitions && (toMode.transition?.duration ?? 0) > 0) {
        await this.waitForTransition(toMode.transition!.duration)
      }

      // Complete switch
      this.currentModeId = toModeId
      this.transitionState.isTransitioning = false

      this.notifyObservers({
        type: 'MODE_SWITCH_COMPLETED',
        modeId: toModeId
      })

      if (this.config.debugMode) {
        console.log(`[ModeManager] Switched to mode: ${toModeId}`)
      }
    } finally {
      this.transitionState.isTransitioning = false
    }
  }

  private async applyModeChanges(mode: ModeDefinition): Promise<void> {
    // Apply CSS custom properties
    this.applyCSSCustomProperties(mode)
    
    // Apply CSS classes
    this.applyCSSClasses(mode)
    
    // Initialize rendering strategy
    try {
      RenderingStrategyFactory.createStrategy(mode.id)
    } catch (error) {
      console.warn(`[ModeManager] No rendering strategy for mode ${mode.id}` , error)
    }
  }

  private applyCSSCustomProperties(mode: ModeDefinition): void {
    const root = document.documentElement
    
  Object.entries(mode.theme.customProperties || {}).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })
  }

  private applyCSSClasses(mode: ModeDefinition): void {
    const canvasContainer = document.querySelector('.canvas-container')
    
    if (canvasContainer) {
      // Remove existing mode classes
      canvasContainer.classList.remove('workflow-mode', 'architecture-mode', 'debug-mode')
      
      // Add new mode class
  if (mode.theme.cssClassName) canvasContainer.classList.add(mode.theme.cssClassName)
    }
  }

  private waitForTransition(duration: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, duration)
    })
  }

  private validateModeForRegistration(mode: ModeDefinition): void {
    if (this.modes.has(mode.id)) {
      throw new Error(`Mode '${mode.id}' is already registered`)
    }

    modeFactory.validateModeConfiguration(mode)
  }

  private updateCache(modeId: string, mode: ModeDefinition): void {
    // Implement LRU cache eviction
    if (this.modeCache.size >= this.config.maxCacheSize) {
      const oldestEntry = Array.from(this.modeCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)[0]
      
      if (oldestEntry) {
        this.modeCache.delete(oldestEntry[0])
      }
    }

    this.modeCache.set(modeId, {
      mode,
      lastAccessed: Date.now()
    })
  }

  private notifyObservers(event: ModeSystemEvent): void {
    this.observers.forEach(observer => {
      try {
        observer.onModeSystemEvent(event)
      } catch (error) {
        console.error('[ModeManager] Observer error:', error)
      }
    })
  }
}

/**
 * Singleton mode manager instance
 */
let modeManagerInstance: ModeManager | null = null

/**
 * Gets the singleton mode manager instance
 */
export const getModeManager = (config?: Partial<ModeSystemConfig>): ModeManager => {
  modeManagerInstance ??= new ModeManager(config)
  return modeManagerInstance
}

/**
 * Resets the mode manager (useful for testing)
 */
export const resetModeManager = (): void => {
  if (modeManagerInstance) {
    modeManagerInstance.cleanup()
    modeManagerInstance = null
  }
}

/**
 * Convenience hook for React components
 */
export interface UseModeManagerReturn {
  currentMode: ModeDefinition | null
  allModes: ModeDefinition[]
  isTransitioning: boolean
  switchMode: (modeId: string) => Promise<void>
  canSwitchToMode: (modeId: string) => boolean
}

export const createModeManagerHook = () => {
  const manager = getModeManager()
  
  return (): UseModeManagerReturn => ({
    currentMode: manager.getCurrentMode(),
    allModes: manager.getAllModes(),
    isTransitioning: false, // Would need React state integration
    switchMode: (modeId: string) => manager.switchMode(modeId),
    canSwitchToMode: (modeId: string) => manager.canSwitchToMode(modeId)
  })
}