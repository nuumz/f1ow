/**
 * Mode System Type Definitions
 * Implements SOLID principles with clear interface segregation
 */

// Core Mode Definition Interface (Single Responsibility)
export interface ModeDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: 'execution' | 'design' | 'analysis' | 'custom'
  readonly theme: ModeTheme
  readonly connectionStyle: ConnectionStyleConfig
  readonly portStyle: PortStyleConfig
  readonly canvasStyle: CanvasStyleConfig
  readonly interactions: InteractionConfig
  readonly metadata: ModeMetadata
  // Optional advanced configuration used by the mode system
  readonly behavior?: ModeBehavior
  readonly transition?: ModeTransition
  readonly priority?: number
  readonly isDefault?: boolean
  readonly dependencies?: string[]
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
  // Optional extended theme sections (present when built via factory)
  readonly connections?: {
    readonly defaultColor: string
    readonly hoverColor: string
    readonly selectedColor: string
    readonly strokeWidth?: number
    readonly hoverStrokeWidth?: number
    readonly selectedStrokeWidth?: number
    readonly opacity?: number
    readonly hoverOpacity?: number
    readonly selectedOpacity?: number
    readonly markerType?: string
  }
  readonly ports?: Record<string, unknown>
  readonly canvas?: {
    readonly backgroundColor?: string
    readonly gridColor?: string
    readonly gridSize?: number
    readonly gridOpacity?: number
  }
  readonly nodes?: Record<string, unknown>
  readonly cssClassName?: string
  readonly customProperties?: Record<string, string>
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
  // Optional canvas transforms hook
  applyCanvasTransformations?(element: SVGSVGElement, canvasTheme?: ModeTheme['canvas']): void
}

// Render Data Interfaces
export interface ConnectionRenderData {
  readonly id: string
  readonly sourcePoint: Point2D
  readonly targetPoint: Point2D
  readonly selected: boolean
  readonly hovered: boolean
  readonly dataType: string
  readonly metadata: Record<string, unknown>
}

export interface PortRenderData {
  readonly id: string
  readonly position: Point2D
  readonly type: 'input' | 'output'
  readonly dataType: string
  readonly connected: boolean
  readonly hovered: boolean
  readonly selected: boolean
  readonly metadata: Record<string, unknown>
}

export interface CanvasRenderData {
  readonly dimensions: Dimensions2D
  readonly transform: Transform2D
  readonly zoom: number
  readonly pan: Point2D
  readonly metadata: Record<string, unknown>
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
  registerMode(mode: ModeDefinition): void
  unregisterMode(modeId: string): void
  getMode(modeId: string): ModeDefinition | null
  getAllModes(): ModeDefinition[]
  getCurrentMode(): ModeDefinition | null
  switchMode(modeId: string): Promise<void>
  canSwitchToMode(modeId: string): boolean
  addObserver(observer: ModeSystemObserver): void
  removeObserver(observer: ModeSystemObserver): void
  createContext(): ModeSystemContext
  getModeHistory(): Array<{ modeId: string; timestamp: number; duration?: number }>
  bulkRegisterModes(modes: ModeDefinition[]): void
  cleanup(): void
}

// Mode Factory Interface (Factory Pattern)  
export interface ModeFactory {
  createMode(config: Partial<Omit<ModeDefinition, 'theme'>> & { theme?: Partial<ModeTheme> }): ModeDefinition
  createRenderingStrategy(modeId: string): ModeRenderingStrategy
  validateModeConfiguration(config: Partial<Omit<ModeDefinition, 'theme'>> & { theme?: Partial<ModeTheme> }): boolean
  cloneMode(baseModeId: string, overrides: Partial<Omit<ModeDefinition, 'theme'>> & { theme?: Partial<ModeTheme> }): ModeDefinition
  getMode(modeId: string): ModeDefinition | null
  getAvailableModes(): ModeIdentifier[]
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
  readonly data?: unknown
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

// Extended Mode System Types
export interface ModeBehavior {
  readonly allowNodeCreation: boolean
  readonly allowNodeDeletion: boolean
  readonly allowConnectionCreation: boolean
  readonly allowConnectionDeletion: boolean
  readonly enableDragAndDrop: boolean
  readonly enableMultiSelection: boolean
  readonly enableContextMenu: boolean
  readonly enableKeyboardShortcuts: boolean
  readonly autoLayout: boolean
  readonly snapToGrid: boolean
  readonly showPortLabels: boolean
  readonly showConnectionLabels: boolean
  readonly enablePortTypeValidation: boolean
  readonly enableExecutionVisualization: boolean
}

export interface ModeTransition {
  readonly duration: number
  readonly easing: string
  readonly staggerDelay: number
  readonly animateConnections: boolean
  readonly animatePorts: boolean
  readonly animateNodes: boolean
  readonly animateCanvas: boolean
}

export interface ModeSystemConfig {
  readonly enableTransitions: boolean
  readonly transitionDuration: number
  readonly enableValidation: boolean
  readonly enableCaching: boolean
  readonly maxCacheSize: number
  readonly debugMode: boolean
  readonly defaultModeId: string
}

export type ModeSystemEvent =
  | { type: 'MODE_REGISTERED'; modeId: string }
  | { type: 'MODE_UNREGISTERED'; modeId: string }
  | { type: 'MODE_SWITCH_STARTED'; fromModeId?: string; toModeId: string }
  | { type: 'MODE_SWITCH_COMPLETED'; modeId: string }
  | { type: 'MODE_SWITCH_FAILED'; modeId: string; error: string }

export interface ModeSystemObserver {
  onModeSystemEvent(event: ModeSystemEvent): void
}

export interface ModeSystemContext {
  readonly modeManager: ModeManager
  readonly modeFactory: ModeFactory
  readonly currentMode: ModeDefinition | null
  readonly isTransitioning: boolean
  readonly observers: ModeSystemObserver[]
}

export interface ModeIdentifier {
  readonly id: string
  readonly name: string
  readonly description: string
}

// Helpful aliases for theme sections
export type ConnectionTheme = NonNullable<ModeTheme['connections']>
export type PortTheme = NonNullable<ModeTheme['ports']>
export type CanvasTheme = NonNullable<ModeTheme['canvas']>
export type NodeTheme = NonNullable<ModeTheme['nodes']>

// Note: All interfaces are already exported individually above