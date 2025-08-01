/**
 * Mode System Type Definitions
 * Implements SOLID principles with clear interface segregation
 */

// Core Mode Definition Interface (Single Responsibility)
export interface ModeDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: 'execution' | 'design' | 'analysis'
  readonly theme: ModeTheme
  readonly connectionStyle: ConnectionStyleConfig
  readonly portStyle: PortStyleConfig
  readonly canvasStyle: CanvasStyleConfig
  readonly interactions: InteractionConfig
  readonly metadata: ModeMetadata
}

// Visual Theme Configuration
export interface ModeTheme {
  readonly primary: string
  readonly secondary: string
  readonly accent: string
  readonly background: string
  readonly foreground: string
  readonly success: string
  readonly warning: string
  readonly error: string
  readonly gradients: ThemeGradients
  readonly shadows: ThemeShadows
}

export interface ThemeGradients {
  readonly primary: string
  readonly secondary: string
  readonly background: string
}

export interface ThemeShadows {
  readonly small: string
  readonly medium: string
  readonly large: string
  readonly connection: string
  readonly port: string
}

// Connection Styling Configuration
export interface ConnectionStyleConfig {
  readonly strokeWidth: number
  readonly strokeDashArray?: string
  readonly opacity: number
  readonly animationType: 'none' | 'flow' | 'pulse' | 'wave'
  readonly markerType: 'arrow' | 'diamond' | 'circle' | 'square'
  readonly markerSize: number
  readonly hoverEffect: HoverEffectConfig
  readonly selectionEffect: SelectionEffectConfig
  readonly transitionDuration: number
}

export interface HoverEffectConfig {
  readonly strokeWidth: number
  readonly opacity: number
  readonly shadowBlur: number
  readonly scaleTransform: number
}

export interface SelectionEffectConfig {
  readonly strokeWidth: number
  readonly opacity: number
  readonly shadowBlur: number
  readonly glowColor: string
  readonly animationDuration: number
}

// Port Styling Configuration
export interface PortStyleConfig {
  readonly shape: 'circle' | 'square' | 'diamond' | 'hexagon'
  readonly size: number
  readonly strokeWidth: number
  readonly shadowBlur: number
  readonly connectedIndicator: ConnectedIndicatorConfig
  readonly typeIndicators: PortTypeIndicators
  readonly hoverEffect: PortHoverConfig
  readonly labelStyle: PortLabelConfig
}

export interface ConnectedIndicatorConfig {
  readonly enabled: boolean
  readonly style: 'glow' | 'pulse' | 'border' | 'fill'
  readonly intensity: number
}

export interface PortTypeIndicators {
  readonly enabled: boolean
  readonly style: 'color' | 'shape' | 'pattern' | 'icon'
  readonly colorMapping: Record<string, string>
}

export interface PortHoverConfig {
  readonly scaleTransform: number
  readonly shadowBlur: number
  readonly transitionDuration: number
}

export interface PortLabelConfig {
  readonly enabled: boolean
  readonly fontSize: number
  readonly fontWeight: 'normal' | 'bold'
  readonly position: 'inside' | 'outside' | 'tooltip'
}

// Canvas Styling Configuration
export interface CanvasStyleConfig {
  readonly backgroundType: 'solid' | 'gradient' | 'pattern' | 'image'
  readonly backgroundValue: string
  readonly gridStyle: GridStyleConfig
  readonly overlayEffects: OverlayEffectConfig[]
  readonly nodeStyle: NodeStyleOverride
  readonly animations: CanvasAnimationConfig
}

export interface GridStyleConfig {
  readonly enabled: boolean
  readonly type: 'dots' | 'lines' | 'cross' | 'diagonal'
  readonly size: number
  readonly color: string
  readonly opacity: number
  readonly style: 'solid' | 'dashed' | 'dotted'
}

export interface OverlayEffectConfig {
  readonly type: 'vignette' | 'noise' | 'scanlines' | 'particles'
  readonly intensity: number
  readonly color: string
  readonly animation?: 'static' | 'slow' | 'medium' | 'fast'
}

export interface NodeStyleOverride {
  readonly borderRadius: number
  readonly shadowIntensity: number
  readonly glowEffect: boolean
  readonly backgroundOpacity: number
}

export interface CanvasAnimationConfig {
  readonly backgroundAnimation: boolean
  readonly gridAnimation: boolean
  readonly transitionDuration: number
  readonly easingFunction: string
}

// Interaction Configuration
export interface InteractionConfig {
  readonly doubleClickAction: 'edit' | 'expand' | 'properties' | 'none'
  readonly dragBehavior: DragBehaviorConfig
  readonly connectionBehavior: ConnectionBehaviorConfig
  readonly selectionBehavior: SelectionBehaviorConfig
  readonly keyboardShortcuts: KeyboardShortcutConfig[]
}

export interface DragBehaviorConfig {
  readonly snapToGrid: boolean
  readonly ghostEffect: boolean
  readonly collisionDetection: boolean
  readonly magneticPorts: boolean
}

export interface ConnectionBehaviorConfig {
  readonly autoRouting: boolean
  readonly smartConnections: boolean
  readonly previewStyle: 'dashed' | 'dotted' | 'solid'
  readonly validationFeedback: boolean
}

export interface SelectionBehaviorConfig {
  readonly multiSelect: boolean
  readonly rectangularSelection: boolean
  readonly selectionIndicator: 'border' | 'highlight' | 'glow'
}

export interface KeyboardShortcutConfig {
  readonly key: string
  readonly modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[]
  readonly action: string
  readonly description: string
}

// Mode Metadata
export interface ModeMetadata {
  readonly version: string
  readonly author: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly tags: string[]
  readonly documentation: string
  readonly examples: ModeExample[]
}

export interface ModeExample {
  readonly title: string
  readonly description: string
  readonly previewUrl?: string
  readonly codeUrl?: string
}

// Mode Rendering Strategy Interface (Strategy Pattern)
export interface ModeRenderingStrategy {
  readonly mode: ModeDefinition
  
  renderConnection(connection: ConnectionRenderData): SVGElement
  renderPort(port: PortRenderData): SVGElement
  renderCanvas(canvas: CanvasRenderData): void
  renderMarkers(defs: SVGDefsElement): void
  
  // State management
  onModeActivated(): void
  onModeDeactivated(): void
  onThemeChanged(theme: ModeTheme): void
  
  // Performance optimization
  shouldRerender(oldData: RenderData, newData: RenderData): boolean
  cleanup(): void
}

// Render Data Interfaces
export interface ConnectionRenderData {
  readonly id: string
  readonly sourcePoint: Point2D
  readonly targetPoint: Point2D
  readonly selected: boolean
  readonly hovered: boolean
  readonly dataType: string
  readonly metadata: Record<string, any>
}

export interface PortRenderData {
  readonly id: string
  readonly position: Point2D
  readonly type: 'input' | 'output'
  readonly dataType: string
  readonly connected: boolean
  readonly hovered: boolean
  readonly selected: boolean
  readonly metadata: Record<string, any>
}

export interface CanvasRenderData {
  readonly dimensions: Dimensions2D
  readonly transform: Transform2D
  readonly zoom: number
  readonly pan: Point2D
  readonly metadata: Record<string, any>
}

export interface RenderData {
  readonly connections: ConnectionRenderData[]
  readonly ports: PortRenderData[]
  readonly canvas: CanvasRenderData
  readonly timestamp: number
}

// Utility Interfaces
export interface Point2D {
  readonly x: number
  readonly y: number
}

export interface Dimensions2D {
  readonly width: number
  readonly height: number
}

export interface Transform2D {
  readonly x: number
  readonly y: number
  readonly scaleX: number
  readonly scaleY: number
  readonly rotation: number
}

// Mode Manager Interface
export interface ModeManager {
  readonly currentMode: ModeDefinition | null
  readonly availableModes: ModeDefinition[]
  
  registerMode(mode: ModeDefinition): void
  unregisterMode(modeId: string): void
  switchMode(modeId: string): Promise<void>
  getMode(modeId: string): ModeDefinition | null
  cloneMode(modeId: string, newId: string): ModeDefinition | null
  
  // Event handling
  onModeChanged(callback: (mode: ModeDefinition) => void): () => void
  onModeRegistered(callback: (mode: ModeDefinition) => void): () => void
  onModeUnregistered(callback: (modeId: string) => void): () => void
}

// Mode Factory Interface (Factory Pattern)  
export interface ModeFactory {
  createMode(type: string, config?: Partial<ModeDefinition>): ModeDefinition
  createRenderingStrategy(mode: ModeDefinition): ModeRenderingStrategy
  validateMode(mode: ModeDefinition): ValidationResult
  cloneMode(source: ModeDefinition, overrides?: Partial<ModeDefinition>): ModeDefinition
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: ValidationError[]
  readonly warnings: ValidationWarning[]
}

export interface ValidationError {
  readonly field: string
  readonly message: string
  readonly code: string
}

export interface ValidationWarning {
  readonly field: string
  readonly message: string
  readonly suggestion?: string
}

// Event System
export interface ModeEvent {
  readonly type: string
  readonly mode: ModeDefinition
  readonly timestamp: number
  readonly data?: any
}

export type ModeEventHandler = (event: ModeEvent) => void

// Performance Monitoring
export interface ModePerformanceMetrics {
  readonly renderTime: number
  readonly memoryUsage: number
  readonly frameRate: number
  readonly cacheHitRate: number
  readonly lastUpdated: Date
}

// Note: All interfaces are already exported individually above