/**
 * Mode Factory - Factory Pattern Implementation
 * 
 * This module implements the Factory pattern for creating mode instances,
 * providing a clean interface for mode creation while encapsulating
 * the complexity of mode configuration and validation.
 */

import type { 
  ModeDefinition, 
  ModeFactory as IModeFactory, 
  ModeRenderingStrategy, 
  ModeIdentifier,
  ModeTheme,
  ModeBehavior,
  ModeTransition,
  ModeMetadata
} from '../types/mode-system'

import { 
  WORKFLOW_MODE, 
  ARCHITECTURE_MODE, 
  DEBUG_MODE
} from './mode-definitions'

import { RenderingStrategyFactory } from './rendering-strategies'

/**
 * Default theme values for fallback
 */
const DEFAULT_THEME_VALUES = {
  connections: {
    defaultColor: '#6b7280',
    hoverColor: '#374151',
    selectedColor: '#3b82f6',
    strokeWidth: 2,
    hoverStrokeWidth: 3,
    selectedStrokeWidth: 3,
    opacity: 1,
    hoverOpacity: 1,
    selectedOpacity: 1,
    markerType: 'arrow' as const
  },
  ports: {
    fillColor: '#ffffff',
    strokeColor: '#6b7280',
    hoverFillColor: '#f3f4f6',
    hoverStrokeColor: '#374151',
    connectedFillColor: '#3b82f6',
    connectedStrokeColor: '#2563eb',
    strokeWidth: 2,
    hoverStrokeWidth: 2,
    connectedStrokeWidth: 2,
    size: 6,
    hoverSize: 7,
    connectedSize: 6
  },
  canvas: {
    backgroundColor: '#ffffff',
    gridColor: '#e5e7eb',
    gridSize: 20,
    gridOpacity: 0.5
  },
  nodes: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    selectedBorderColor: '#3b82f6',
    hoverBackgroundColor: '#f9fafb',
    textColor: '#1f2937',
    borderWidth: 1,
    selectedBorderWidth: 2,
    borderRadius: 6,
    dropShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    hoverDropShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    selectedDropShadow: '0 4px 16px rgba(59, 130, 246, 0.25)',
    opacity: 1,
    hoverOpacity: 1,
    selectedOpacity: 1
  }
}

/**
 * Default behavior values for fallback
 */
const DEFAULT_BEHAVIOR_VALUES: ModeBehavior = {
  allowNodeCreation: true,
  allowNodeDeletion: true,
  allowConnectionCreation: true,
  allowConnectionDeletion: true,
  enableDragAndDrop: true,
  enableMultiSelection: true,
  enableContextMenu: true,
  enableKeyboardShortcuts: true,
  autoLayout: false,
  snapToGrid: false,
  showPortLabels: false,
  showConnectionLabels: false,
  enablePortTypeValidation: true,
  enableExecutionVisualization: false
}

/**
 * Default transition values for fallback
 */
const DEFAULT_TRANSITION_VALUES: ModeTransition = {
  duration: 300,
  easing: 'ease-in-out',
  staggerDelay: 50,
  animateConnections: true,
  animatePorts: true,
  animateNodes: true,
  animateCanvas: true
}

/**
 * Concrete implementation of the Mode Factory
 * Follows Factory Pattern to encapsulate mode creation logic
 */
export class ModeFactory implements IModeFactory {
  private readonly modeRegistry = new Map<string, ModeDefinition>()
  private readonly validationRules = new Map<string, (value: unknown) => boolean>()

  constructor() {
    // Register built-in modes
    this.registerBuiltInModes()
    this.initializeValidationRules()
  }

  /**
   * Creates a mode definition from partial configuration
   * Factory Method: Creates objects without specifying exact classes
   */
  createMode(config: Partial<Omit<ModeDefinition, 'theme'>> & { theme?: Partial<ModeTheme> }): ModeDefinition {
    this.validateModeConfiguration(config)

    const modeId = config.id || this.generateModeId()
    const baseName = config.name || `Custom Mode ${modeId}`

    // Create complete theme by merging with defaults
  const theme = this.createCompleteTheme(config.theme)
    
    // Create complete behavior by merging with defaults
    const behavior = this.createCompleteBehavior(config.behavior)
    
    // Create complete transition by merging with defaults
    const transition = this.createCompleteTransition(config.transition)

    const mode: ModeDefinition = {
      id: modeId,
      name: baseName,
      description: config.description || `Custom mode: ${baseName}`,
      theme,
      connectionStyle: {
        strokeWidth: 2,
        strokeDashArray: undefined,
        opacity: 1,
        animationType: 'none',
        markerType: 'arrow',
        markerSize: 10,
        hoverEffect: { strokeWidth: 3, opacity: 1, shadowBlur: 8, scaleTransform: 1.05 },
        selectionEffect: { strokeWidth: 4, opacity: 1, shadowBlur: 12, glowColor: '#3b82f6', animationDuration: 1000 },
        transitionDuration: 200
      },
      portStyle: {
        shape: 'circle', size: 8, strokeWidth: 2, shadowBlur: 4,
        connectedIndicator: { enabled: true, style: 'glow', intensity: 0.8 },
        typeIndicators: { enabled: true, style: 'color', colorMapping: {} },
        hoverEffect: { scaleTransform: 1.2, shadowBlur: 8, transitionDuration: 150 },
        labelStyle: { enabled: false, fontSize: 11, fontWeight: 'normal', position: 'outside' }
      },
      canvasStyle: {
        backgroundType: 'solid', backgroundValue: '#ffffff',
        gridStyle: { enabled: true, type: 'dots', size: 20, color: '#e5e7eb', opacity: 0.5, style: 'solid' },
        overlayEffects: [],
        nodeStyle: { borderRadius: 6, shadowIntensity: 0.15, glowEffect: false, backgroundOpacity: 1 },
        animations: { backgroundAnimation: false, gridAnimation: false, transitionDuration: 300, easingFunction: 'linear' }
      },
      interactions: {
        doubleClickAction: 'edit',
        dragBehavior: { snapToGrid: true, ghostEffect: true, collisionDetection: true, magneticPorts: true },
        connectionBehavior: { autoRouting: true, smartConnections: true, previewStyle: 'dashed', validationFeedback: true },
        selectionBehavior: { multiSelect: true, rectangularSelection: true, selectionIndicator: 'border' },
        keyboardShortcuts: []
      },
      behavior,
      transition,
      category: (config as Partial<ModeDefinition>).category || 'custom',
      priority: (config as Partial<ModeDefinition>).priority || 999,
      isDefault: (config as Partial<ModeDefinition>).isDefault || false,
      dependencies: (config as Partial<ModeDefinition>).dependencies || [],
      metadata: this.createCompleteMetadata((config as Partial<ModeDefinition>).metadata as Partial<ModeMetadata> | undefined)
    }

    // Register the created mode
    this.modeRegistry.set(modeId, mode)

    return mode
  }

  /**
   * Creates a rendering strategy for a specific mode
   */
  createRenderingStrategy(modeId: string): ModeRenderingStrategy {
    if (!this.modeRegistry.has(modeId)) {
      throw new Error(`Mode '${modeId}' is not registered`)
    }

    try {
      return RenderingStrategyFactory.createStrategy(modeId)
    } catch (error) {
      // Fallback to workflow strategy if specific strategy not found
      console.warn(`No specific rendering strategy for mode '${modeId}', using workflow strategy`, error)
      return RenderingStrategyFactory.createStrategy('workflow')
    }
  }

  /**
   * Validates mode configuration
   * Template Method: Defines validation algorithm structure
   */
  validateModeConfiguration(config: Partial<Omit<ModeDefinition, 'theme'>> & { theme?: Partial<ModeTheme> }): boolean {
    const errors: string[] = []

    // ID validation
    if (config.id && !this.validateModeId(config.id)) {
      errors.push('Invalid mode ID: must be alphanumeric with dashes/underscores only')
    }

    // Name validation
    if (config.name && config.name.trim().length === 0) {
      errors.push('Mode name cannot be empty')
    }

    // Theme validation
    if (config.theme && !this.validateTheme(config.theme)) {
      errors.push('Invalid theme configuration')
    }

    // Behavior validation
    if (config.behavior && !this.validateBehavior(config.behavior)) {
      errors.push('Invalid behavior configuration')
    }

    // Transition validation
    if (config.transition && !this.validateTransition(config.transition)) {
      errors.push('Invalid transition configuration')
    }

    // Category validation
    if (config.category && !this.validateCategory(config.category)) {
      errors.push('Invalid category: must be one of workflow, architecture, debug, analysis, custom')
    }

    if (errors.length > 0) {
      throw new Error(`Mode validation failed: ${errors.join(', ')}`)
    }

    return true
  }

  /**
   * Lists all available mode types
   */
  getAvailableModes(): ModeIdentifier[] {
    return Array.from(this.modeRegistry.values()).map(mode => ({
      id: mode.id,
      name: mode.name,
      description: mode.description
    }))
  }

  /**
   * Gets a registered mode by ID
   */
  getMode(modeId: string): ModeDefinition | null {
    return this.modeRegistry.get(modeId) || null
  }

  /**
   * Registers a pre-built mode
   */
  registerMode(mode: ModeDefinition): void {
    this.validateModeConfiguration(mode)
    this.modeRegistry.set(mode.id, mode)
  }

  /**
   * Clones an existing mode with modifications
   */
  cloneMode(baseModeId: string, overrides: Partial<Omit<ModeDefinition, 'theme'>> & { theme?: Partial<ModeTheme> }): ModeDefinition {
    const baseMode = this.modeRegistry.get(baseModeId)
    if (!baseMode) {
      throw new Error(`Base mode '${baseModeId}' not found`)
    }

    const clonedConfig = {
      ...baseMode,
      ...overrides,
      id: overrides.id || `${baseModeId}-clone-${Date.now()}`,
  theme: overrides.theme ? this.mergeThemes(baseMode.theme, overrides.theme) : baseMode.theme,
      behavior: overrides.behavior ? { ...baseMode.behavior, ...overrides.behavior } : baseMode.behavior,
      transition: overrides.transition ? { ...baseMode.transition, ...overrides.transition } : baseMode.transition
    }

    return this.createMode(clonedConfig)
  }

  /**
   * Creates a custom mode template
   */
  createModeTemplate(category: string): Partial<ModeDefinition> {
    const baseMode = this.getDefaultModeForCategory(category)
    
    return {
      id: `custom-${category}-${Date.now()}`,
      name: `Custom ${category} Mode`,
      description: `Custom mode for ${category} workflows`,
      theme: baseMode?.theme,
      behavior: baseMode?.behavior,
      transition: baseMode?.transition,
      category: category as unknown as ModeDefinition['category'],
      priority: 500,
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['custom', category],
        documentation: '',
        examples: []
      }
    }
  }

  // Private helper methods

  private registerBuiltInModes(): void {
    [WORKFLOW_MODE, ARCHITECTURE_MODE, DEBUG_MODE].forEach(mode => {
      this.modeRegistry.set(mode.id, mode)
    })
  }

  private initializeValidationRules(): void {
    this.validationRules.set('modeId', (id: unknown): boolean => {
      return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)
    })

    this.validationRules.set('color', (color: unknown): boolean => {
      return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)
    })

    this.validationRules.set('duration', (duration: unknown): boolean => {
      return typeof duration === 'number' && duration > 0 && duration <= 5000
    })
  }

  private validateModeId(id: string): boolean {
    const validator = this.validationRules.get('modeId')
    return validator ? validator(id) : false
  }

  private validateTheme(theme: Partial<ModeTheme>): boolean {
    // Validate color values if present
    const colorValidator = this.validationRules.get('color')
    if (!colorValidator) return true

    const colorFields = [
      theme.connections?.defaultColor,
      theme.connections?.hoverColor,
      theme.connections?.selectedColor,
      theme.ports?.fillColor,
      theme.ports?.strokeColor,
      theme.canvas?.backgroundColor
    ].filter(color => color !== undefined)

    return colorFields.every(color => colorValidator(color))
  }

  private validateBehavior(behavior: Partial<ModeBehavior>): boolean {
    // All behavior properties are boolean, so basic type checking suffices
    return Object.values(behavior).every(value => 
      value === undefined || typeof value === 'boolean'
    )
  }

  private validateTransition(transition: Partial<ModeTransition>): boolean {
    const durationValidator = this.validationRules.get('duration')
    
    if (transition.duration !== undefined && durationValidator) {
      return durationValidator(transition.duration)
    }

    return true
  }

  private validateCategory(category: string): boolean {
    const validCategories = ['workflow', 'architecture', 'debug', 'analysis', 'custom']
    return validCategories.includes(category)
  }

  private generateModeId(): string {
    return `mode-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  }

  private createCompleteTheme(partialTheme?: Partial<ModeTheme>): ModeTheme {
    const DEFAULT_CORE_THEME: Omit<ModeTheme, 'connections' | 'ports' | 'canvas' | 'nodes' | 'cssClassName' | 'customProperties'> = {
      primary: '#2563eb',
      secondary: '#3b82f6',
      accent: '#1d4ed8',
      background: '#f8fafc',
      foreground: '#1e293b',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      gradients: {
        primary: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
        secondary: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      },
      shadows: {
        small: '0 2px 4px rgba(37, 99, 235, 0.1)',
        medium: '0 4px 12px rgba(37, 99, 235, 0.15)',
        large: '0 8px 32px rgba(37, 99, 235, 0.2)',
        connection: '0 2px 8px rgba(37, 99, 235, 0.25)',
        port: '0 2px 6px rgba(37, 99, 235, 0.2)'
      }
    }

    return {
      primary: partialTheme?.primary ?? DEFAULT_CORE_THEME.primary,
      secondary: partialTheme?.secondary ?? DEFAULT_CORE_THEME.secondary,
      accent: partialTheme?.accent ?? DEFAULT_CORE_THEME.accent,
      background: partialTheme?.background ?? DEFAULT_CORE_THEME.background,
      foreground: partialTheme?.foreground ?? DEFAULT_CORE_THEME.foreground,
      success: partialTheme?.success ?? DEFAULT_CORE_THEME.success,
      warning: partialTheme?.warning ?? DEFAULT_CORE_THEME.warning,
      error: partialTheme?.error ?? DEFAULT_CORE_THEME.error,
      gradients: partialTheme?.gradients ?? DEFAULT_CORE_THEME.gradients,
      shadows: partialTheme?.shadows ?? DEFAULT_CORE_THEME.shadows,
      connections: { ...DEFAULT_THEME_VALUES.connections, ...partialTheme?.connections },
      ports: { ...DEFAULT_THEME_VALUES.ports, ...partialTheme?.ports },
      canvas: { ...DEFAULT_THEME_VALUES.canvas, ...partialTheme?.canvas },
      nodes: { ...DEFAULT_THEME_VALUES.nodes, ...partialTheme?.nodes },
      cssClassName: partialTheme?.cssClassName || 'default-mode',
      customProperties: partialTheme?.customProperties || {}
    }
  }

  private createCompleteBehavior(partialBehavior?: Partial<ModeBehavior>): ModeBehavior {
    return { ...DEFAULT_BEHAVIOR_VALUES, ...partialBehavior }
  }

  private createCompleteTransition(partialTransition?: Partial<ModeTransition>): ModeTransition {
    return { ...DEFAULT_TRANSITION_VALUES, ...partialTransition }
  }

  private mergeThemes(baseTheme: ModeTheme, overrideTheme: Partial<ModeTheme>): ModeTheme {
    return {
      primary: overrideTheme.primary ?? baseTheme.primary,
      secondary: overrideTheme.secondary ?? baseTheme.secondary,
      accent: overrideTheme.accent ?? baseTheme.accent,
      background: overrideTheme.background ?? baseTheme.background,
      foreground: overrideTheme.foreground ?? baseTheme.foreground,
      success: overrideTheme.success ?? baseTheme.success,
      warning: overrideTheme.warning ?? baseTheme.warning,
      error: overrideTheme.error ?? baseTheme.error,
      gradients: overrideTheme.gradients ?? baseTheme.gradients,
      shadows: overrideTheme.shadows ?? baseTheme.shadows,
      connections: {
        defaultColor: overrideTheme.connections?.defaultColor ?? baseTheme.connections!.defaultColor,
        hoverColor: overrideTheme.connections?.hoverColor ?? baseTheme.connections!.hoverColor,
        selectedColor: overrideTheme.connections?.selectedColor ?? baseTheme.connections!.selectedColor,
        strokeWidth: overrideTheme.connections?.strokeWidth ?? baseTheme.connections!.strokeWidth,
        hoverStrokeWidth: overrideTheme.connections?.hoverStrokeWidth ?? baseTheme.connections!.hoverStrokeWidth,
        selectedStrokeWidth: overrideTheme.connections?.selectedStrokeWidth ?? baseTheme.connections!.selectedStrokeWidth,
        opacity: overrideTheme.connections?.opacity ?? baseTheme.connections!.opacity,
        hoverOpacity: overrideTheme.connections?.hoverOpacity ?? baseTheme.connections!.hoverOpacity,
        selectedOpacity: overrideTheme.connections?.selectedOpacity ?? baseTheme.connections!.selectedOpacity,
        markerType: overrideTheme.connections?.markerType ?? baseTheme.connections!.markerType
      },
      ports: { ...baseTheme.ports, ...overrideTheme.ports },
      canvas: { ...baseTheme.canvas, ...overrideTheme.canvas },
      nodes: { ...baseTheme.nodes, ...overrideTheme.nodes },
      cssClassName: overrideTheme.cssClassName || baseTheme.cssClassName,
      customProperties: { ...baseTheme.customProperties, ...overrideTheme.customProperties }
    }
  }

  private createCompleteMetadata(partial?: Partial<ModeMetadata>): ModeMetadata {
    const defaults: ModeMetadata = {
      version: '1.0.0',
      author: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      documentation: '',
      examples: []
    }
    return { ...defaults, ...partial }
  }

  private getDefaultModeForCategory(category: string): ModeDefinition | null {
    switch (category) {
      case 'workflow':
        return WORKFLOW_MODE
      case 'architecture':
        return ARCHITECTURE_MODE
      case 'debug':
        return DEBUG_MODE
      default:
        return WORKFLOW_MODE
    }
  }
}

/**
 * Singleton factory instance
 */
export const modeFactory = new ModeFactory()

/**
 * Convenience functions for common mode operations
 */
export const createWorkflowMode = (overrides?: Partial<ModeDefinition>): ModeDefinition => {
  return modeFactory.cloneMode('workflow', overrides || {})
}

export const createArchitectureMode = (overrides?: Partial<ModeDefinition>): ModeDefinition => {
  return modeFactory.cloneMode('architecture', overrides || {})
}

export const createDebugMode = (overrides?: Partial<ModeDefinition>): ModeDefinition => {
  return modeFactory.cloneMode('debug', overrides || {})
}

export const createCustomMode = (config: Partial<ModeDefinition>): ModeDefinition => {
  return modeFactory.createMode(config)
}