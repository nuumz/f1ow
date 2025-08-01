# API Reference - f1ow Workflow Engine Frontend

## 📚 Complete API Documentation

เอกสารอ้างอิง API ครบถ้วนสำหรับ f1ow Workflow Engine Frontend รวมถึง components, hooks, types, และ utilities

## 🧩 Core Components API

### WorkflowDesigner

Main workflow designer component ที่รวมทุกฟีเจอร์ไว้ในที่เดียว

```typescript
interface WorkflowDesignerProps {
  /** Workflow data to load and edit */
  workflow?: Workflow
  
  /** Operating mode: workflow automation or architecture design */
  mode?: 'workflow' | 'architecture'
  
  /** Disable editing capabilities */
  readOnly?: boolean
  
  /** Custom CSS classes */
  className?: string
  
  /** Initial canvas position and zoom */
  initialView?: {
    x: number
    y: number
    zoom: number
  }
  
  // Event handlers
  /** Called when workflow is saved */
  onSave?: (workflow: Workflow) => void | Promise<void>
  
  /** Called when workflow execution is requested */
  onExecute?: (workflow: Workflow) => void | Promise<void>
  
  /** Called when workflow structure changes */
  onChange?: (workflow: Workflow) => void
  
  /** Called when nodes are selected */
  onSelectionChange?: (nodeIds: string[]) => void
  
  /** Called when canvas view changes */
  onViewChange?: (view: CanvasView) => void
  
  /** Error handler for async operations */
  onError?: (error: Error) => void
}

/**
 * Main workflow designer component
 * 
 * @example
 * ```tsx
 * <WorkflowDesigner
 *   mode="workflow"
 *   onSave={async (workflow) => {
 *     await api.saveWorkflow(workflow)
 *   }}
 *   onExecute={(workflow) => {
 *     api.executeWorkflow(workflow.id)
 *   }}
 * />
 * ```
 */
export const WorkflowDesigner: React.FC<WorkflowDesignerProps>
```

### NodePalette

Unified node palette สำหรับทั้ง workflow และ architecture modes

```typescript
interface NodePaletteProps {
  /** Current mode determines available nodes */
  mode: 'workflow' | 'architecture'
  
  /** Filter nodes by search term */
  searchTerm?: string
  
  /** Selected category filter */
  selectedCategory?: string
  
  /** Custom CSS classes */
  className?: string
  
  /** Show category headers */
  showCategories?: boolean
  
  /** Enable search functionality */
  searchEnabled?: boolean
  
  /** Custom node renderer */
  nodeRenderer?: (node: NodeType) => React.ReactNode
  
  // Event handlers
  /** Called when node drag starts */
  onNodeDragStart?: (nodeType: string, event: DragEvent) => void
  
  /** Called when node is selected/clicked */
  onNodeSelect?: (nodeType: string) => void
  
  /** Called when category is changed */
  onCategoryChange?: (category: string) => void
  
  /** Called when search term changes */
  onSearchChange?: (searchTerm: string) => void
}

/**
 * Unified node palette with 22 node types per mode
 * 
 * @example
 * ```tsx
 * <NodePalette
 *   mode="workflow"
 *   searchEnabled
 *   onNodeDragStart={(nodeType) => {
 *     console.log(`Starting drag for ${nodeType}`)
 *   }}
 * />
 * ```
 */
export const NodePalette: React.FC<NodePaletteProps>
```

### WorkflowCanvas

Main canvas component สำหรับ rendering และ interaction

```typescript
interface WorkflowCanvasProps {
  /** Nodes to render */
  nodes: WorkflowNode[]
  
  /** Connections between nodes */
  connections: Connection[]
  
  /** Current operating mode */
  mode: 'workflow' | 'architecture'
  
  /** Canvas dimensions */
  width?: number
  height?: number
  
  /** Disable interactions */
  readOnly?: boolean
  
  /** Show grid background */
  showGrid?: boolean
  
  /** Grid size in pixels */
  gridSize?: number
  
  /** Snap to grid */
  snapToGrid?: boolean
  
  /** Custom CSS classes */
  className?: string
  
  // Event handlers
  /** Called when node position changes */
  onNodeMove?: (nodeId: string, position: Position) => void
  
  /** Called when node is selected */
  onNodeSelect?: (nodeId: string | null) => void
  
  /** Called when nodes are deleted */
  onNodesDelete?: (nodeIds: string[]) => void
  
  /** Called when connection is created */
  onConnection?: (connection: Partial<Connection>) => void
  
  /** Called when connection is deleted */
  onConnectionDelete?: (connectionId: string) => void
  
  /** Called when canvas is clicked (deselect) */
  onCanvasClick?: (event: React.MouseEvent) => void
  
  /** Called when multiple nodes are selected */
  onMultiSelect?: (nodeIds: string[]) => void
}

/**
 * Main canvas for workflow and architecture diagrams
 * 
 * @example
 * ```tsx
 * <WorkflowCanvas
 *   nodes={workflow.nodes}
 *   connections={workflow.connections}
 *   mode="workflow"
 *   showGrid
 *   onNodeMove={(nodeId, position) => {
 *     updateNode(nodeId, { position })
 *   }}
 * />
 * ```
 */
export const WorkflowCanvas: React.FC<WorkflowCanvasProps>
```

### CanvasToolbar

Canvas control toolbar พร้อม zoom และ view controls

```typescript
interface CanvasToolbarProps {
  /** Current zoom level (0.1 to 5.0) */
  currentZoom?: number
  
  /** Current view/fit mode */
  currentView?: 'fit' | 'actual' | 'custom'
  
  /** Show zoom percentage */
  showZoomLevel?: boolean
  
  /** Custom CSS classes */
  className?: string
  
  /** Hide specific controls */
  hiddenControls?: Array<'zoom-in' | 'zoom-out' | 'reset' | 'fit'>
  
  // Event handlers
  /** Called when zoom in is requested */
  onZoomIn?: () => void
  
  /** Called when zoom out is requested */
  onZoomOut?: () => void
  
  /** Called when canvas reset is requested */
  onReset?: () => void
  
  /** Called when fit to screen is requested */
  onFit?: () => void
  
  /** Called when actual size is requested */
  onActualSize?: () => void
}

/**
 * Canvas toolbar with zoom and view controls
 * Icons are 16px for better visibility
 * 
 * @example
 * ```tsx
 * <CanvasToolbar
 *   currentZoom={1.2}
 *   showZoomLevel
 *   onZoomIn={() => canvas.zoomIn()}
 *   onReset={() => canvas.resetCanvasPosition()}
 * />
 * ```
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps>
```

## 🎣 Hooks API

### useWorkflowContext

Main context hook สำหรับ workflow state management

```typescript
interface WorkflowContextType {
  // State
  state: WorkflowState
  dispatch: React.Dispatch<WorkflowAction>
  
  // Dragging state (prevents stale closures)
  draggingState: DraggingState
  isDragging: () => boolean
  getDraggedNodeId: () => string | null
  startDragging: (nodeId: string, position: Position) => void
  endDragging: () => void
  
  // Node operations
  addNode: (node: WorkflowNode) => void
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  deleteNode: (nodeId: string) => void
  duplicateNode: (nodeId: string) => WorkflowNode | null
  selectNode: (nodeId: string | null) => void
  
  // Connection operations
  addConnection: (connection: Connection) => void
  updateConnection: (connectionId: string, updates: Partial<Connection>) => void
  deleteConnection: (connectionId: string) => void
  
  // Workflow operations
  loadWorkflow: (workflow: Workflow) => void
  saveWorkflow: () => Promise<void>
  clearWorkflow: () => void
  
  // Mode operations
  setMode: (mode: 'workflow' | 'architecture') => void
  
  // Selection operations
  setSelectedNodes: (nodeIds: string[]) => void
  clearSelection: () => void
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/**
 * Main workflow context hook
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { 
 *     state, 
 *     addNode, 
 *     updateNode, 
 *     isDragging 
 *   } = useWorkflowContext()
 *   
 *   const handleAddNode = () => {
 *     const newNode = {
 *       id: crypto.randomUUID(),
 *       type: 'http',
 *       name: 'HTTP Request',
 *       position: { x: 100, y: 100 },
 *       config: {},
 *       inputs: [],
 *       outputs: []
 *     }
 *     addNode(newNode)
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Nodes: {state.nodes.length}</p>
 *       <p>Dragging: {isDragging() ? 'Yes' : 'No'}</p>
 *       <button onClick={handleAddNode}>Add Node</button>
 *     </div>
 *   )
 * }
 * ```
 */
export const useWorkflowContext: () => WorkflowContextType
```

### useWorkflowCanvas

Canvas-specific operations และ zoom management

```typescript
interface CanvasControls {
  // Zoom operations
  zoomIn: (factor?: number) => void
  zoomOut: (factor?: number) => void
  setZoom: (zoom: number) => void
  currentZoom: number
  
  // View operations
  resetCanvasPosition: (nodes?: WorkflowNode[]) => void
  fitToScreen: (nodes?: WorkflowNode[]) => void
  centerOn: (position: Position) => void
  panTo: (position: Position) => void
  
  // View state
  canvasTransform: CanvasTransform
  viewBox: ViewBox
  
  // Canvas utilities
  screenToCanvas: (screenPoint: Position) => Position
  canvasToScreen: (canvasPoint: Position) => Position
  getVisibleNodes: (nodes: WorkflowNode[]) => WorkflowNode[]
  
  // Event handlers
  setupCanvasEvents: (svg: SVGSVGElement) => void
  cleanupCanvasEvents: () => void
}

/**
 * Canvas operations and zoom management
 * Includes conditional reset logic: 1 node = center, >1 nodes = 30%/40%
 * 
 * @example
 * ```tsx
 * const CanvasComponent = () => {
 *   const { 
 *     zoomIn, 
 *     zoomOut, 
 *     resetCanvasPosition, 
 *     currentZoom 
 *   } = useWorkflowCanvas()
 *   
 *   const { state } = useWorkflowContext()
 *   
 *   const handleReset = () => {
 *     // Conditional logic based on node count
 *     resetCanvasPosition(state.nodes)
 *   }
 *   
 *   return (
 *     <div>
 *       <button onClick={() => zoomIn()}>Zoom In</button>
 *       <button onClick={() => zoomOut()}>Zoom Out</button>
 *       <button onClick={handleReset}>Reset</button>
 *       <span>Zoom: {(currentZoom * 100).toFixed(0)}%</span>
 *     </div>
 *   )
 * }
 * ```
 */
export const useWorkflowCanvas: () => CanvasControls
```

### useNodeOperations

High-level node operations และ utilities

```typescript
interface NodeOperations {
  // Node creation
  createNode: (type: string, position: Position) => WorkflowNode
  createNodeFromTemplate: (template: NodeTemplate, position: Position) => WorkflowNode
  
  // Node manipulation
  duplicateNode: (nodeId: string, offset?: Position) => WorkflowNode | null
  moveNodes: (nodeIds: string[], delta: Position) => void
  alignNodes: (nodeIds: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  distributeNodes: (nodeIds: string[], direction: 'horizontal' | 'vertical') => void
  
  // Node validation
  validateNode: (node: WorkflowNode) => ValidationResult
  validateConnections: (node: WorkflowNode, connections: Connection[]) => ValidationResult
  
  // Node queries
  getNodesByType: (type: string) => WorkflowNode[]
  getConnectedNodes: (nodeId: string) => { incoming: WorkflowNode[], outgoing: WorkflowNode[] }
  findNodePath: (fromNodeId: string, toNodeId: string) => WorkflowNode[] | null
  
  // Node dependencies
  getDependencies: (nodeId: string) => string[]
  getDependents: (nodeId: string) => string[]
  hasCircularDependency: (fromNodeId: string, toNodeId: string) => boolean
}

/**
 * High-level node operations
 * 
 * @example
 * ```tsx
 * const NodeManager = () => {
 *   const { createNode, duplicateNode, alignNodes } = useNodeOperations()
 *   const { state, selectNode } = useWorkflowContext()
 *   
 *   const handleDuplicate = () => {
 *     if (state.selectedNodeId) {
 *       const newNode = duplicateNode(state.selectedNodeId)
 *       if (newNode) {
 *         selectNode(newNode.id)
 *       }
 *     }
 *   }
 *   
 *   const handleAlignLeft = () => {
 *     const selectedIds = state.selectedNodes || []
 *     if (selectedIds.length > 1) {
 *       alignNodes(selectedIds, 'left')
 *     }
 *   }
 *   
 *   return (
 *     <div>
 *       <button onClick={handleDuplicate}>Duplicate</button>
 *       <button onClick={handleAlignLeft}>Align Left</button>
 *     </div>
 *   )
 * }
 * ```
 */
export const useNodeOperations: () => NodeOperations
```

### useKeyboardShortcuts

Keyboard shortcuts management

```typescript
interface KeyboardShortcuts {
  // Shortcut registration
  registerShortcut: (
    key: string, 
    handler: () => void, 
    options?: ShortcutOptions
  ) => void
  
  unregisterShortcut: (key: string) => void
  
  // Predefined shortcuts
  setupDefaultShortcuts: () => void
  
  // Shortcut state
  activeShortcuts: Record<string, ShortcutHandler>
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
}

interface ShortcutOptions {
  /** Prevent default browser behavior */
  preventDefault?: boolean
  
  /** Stop event propagation */
  stopPropagation?: boolean
  
  /** Only trigger when specific element is focused */
  target?: HTMLElement | null
  
  /** Require specific modifier keys */
  modifiers?: {
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
  }
}

/**
 * Keyboard shortcuts management
 * 
 * @example
 * ```tsx
 * const ShortcutManager = () => {
 *   const { registerShortcut, setupDefaultShortcuts } = useKeyboardShortcuts()
 *   const { addNode } = useWorkflowContext()
 *   
 *   useEffect(() => {
 *     // Setup default shortcuts (Ctrl+Z, Ctrl+Y, Delete, etc.)
 *     setupDefaultShortcuts()
 *     
 *     // Custom shortcut
 *     registerShortcut('ctrl+shift+h', () => {
 *       addNode(createHTTPNode())
 *     }, { preventDefault: true })
 *   }, [])
 *   
 *   return null
 * }
 * ```
 */
export const useKeyboardShortcuts: () => KeyboardShortcuts
```

## 🏗️ Types & Interfaces

### Core Workflow Types

```typescript
interface Workflow {
  id: string
  name: string
  description?: string
  version: string
  createdAt: string
  updatedAt: string
  
  // Workflow content
  nodes: WorkflowNode[]
  connections: Connection[]
  
  // Configuration
  config: WorkflowConfig
  metadata: WorkflowMetadata
  
  // Execution
  triggers: WorkflowTrigger[]
  variables: Record<string, any>
}

interface WorkflowNode {
  id: string
  type: string
  name: string
  description?: string
  
  // Visual properties
  position: Position
  size?: Size
  
  // Node configuration
  config: Record<string, any>
  
  // Input/Output definitions
  inputs: NodeInput[]
  outputs: NodeOutput[]
  
  // Visual styling
  style?: NodeStyle
  
  // Metadata
  metadata?: Record<string, any>
}

interface Connection {
  id: string
  
  // Connection points
  from: {
    nodeId: string
    outputId: string
  }
  to: {
    nodeId: string
    inputId: string
  }
  
  // Connection properties
  condition?: string
  label?: string
  
  // Visual styling
  style?: ConnectionStyle
  
  // Metadata
  metadata?: Record<string, any>
}

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}
```

### Node System Types

```typescript
interface NodeInput {
  id: string
  name: string
  type: DataType
  required: boolean
  multiple: boolean
  description?: string
  defaultValue?: any
}

interface NodeOutput {
  id: string
  name: string
  type: DataType
  description?: string
}

type DataType = 
  | 'any'
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file'
  | 'image'
  | 'json'
  | 'xml'
  | 'csv'

interface NodeStyle {
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  textColor?: string
  fontSize?: number
  icon?: string
  iconColor?: string
}

interface ConnectionStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  animated?: boolean
  color?: string
}
```

### Canvas & Interaction Types

```typescript
interface CanvasTransform {
  x: number
  y: number
  zoom: number
}

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

interface DraggingState {
  isDragging: boolean
  draggedNodeId?: string
  startPosition?: Position
  currentPosition?: Position
  offset?: Position
}

interface SelectionState {
  selectedNodeIds: string[]
  selectionBox?: BoundingBox
  multiSelectMode: boolean
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}
```

### Context & State Types

```typescript
interface WorkflowState {
  // Core data
  workflow: Workflow | null
  nodes: WorkflowNode[]
  connections: Connection[]
  
  // UI state
  mode: 'workflow' | 'architecture'
  selectedNodeId: string | null
  selectedNodeIds: string[]
  
  // Interaction state
  draggingState: DraggingState
  selectionState: SelectionState
  
  // Canvas state
  canvasTransform: CanvasTransform
  
  // Editor state
  showGrid: boolean
  snapToGrid: boolean
  readOnly: boolean
  
  // History
  history: WorkflowState[]
  historyIndex: number
  
  // Loading state
  isLoading: boolean
  isSaving: boolean
  
  // Errors
  errors: Record<string, string>
}

type WorkflowAction =
  | { type: 'LOAD_WORKFLOW'; payload: Workflow }
  | { type: 'SET_MODE'; payload: 'workflow' | 'architecture' }
  | { type: 'ADD_NODE'; payload: WorkflowNode }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; updates: Partial<WorkflowNode> } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'SET_SELECTED_NODES'; payload: string[] }
  | { type: 'START_DRAGGING'; payload: { nodeId: string; position: Position } }
  | { type: 'END_DRAGGING' }
  | { type: 'ADD_CONNECTION'; payload: Connection }
  | { type: 'DELETE_CONNECTION'; payload: string }
  | { type: 'SET_CANVAS_TRANSFORM'; payload: CanvasTransform }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_ERROR'; payload: { key: string; message: string } }
  | { type: 'CLEAR_ERROR'; payload: string }
```

## 🛠️ Utility Functions API

### Canvas Utilities

```typescript
/**
 * Convert screen coordinates to canvas coordinates
 */
export function screenToCanvas(
  screenPoint: Position,
  transform: CanvasTransform,
  containerElement: HTMLElement
): Position

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
  canvasPoint: Position,
  transform: CanvasTransform,
  containerElement: HTMLElement
): Position

/**
 * Calculate bounding box for a set of nodes
 */
export function calculateBoundingBox(nodes: WorkflowNode[]): BoundingBox

/**
 * Check if a point is inside a bounding box
 */
export function isPointInBounds(point: Position, bounds: BoundingBox): boolean

/**
 * Calculate the optimal zoom level to fit nodes in viewport
 */
export function calculateFitZoom(
  nodes: WorkflowNode[],
  viewportSize: Size,
  padding?: number
): number

/**
 * Calculate connection path between two points
 */
export function calculateConnectionPath(
  from: Position,
  to: Position,
  pathType?: 'straight' | 'curved' | 'orthogonal'
): string
```

### Node Utilities

```typescript
/**
 * Generate unique node ID
 */
export function generateNodeId(): string

/**
 * Get default configuration for node type
 */
export function getDefaultNodeConfig(nodeType: string): Record<string, any>

/**
 * Get node schema for dynamic form generation
 */
export function getNodeSchema(nodeType: string): NodeSchema

/**
 * Validate node configuration against schema
 */
export function validateNodeConfig(
  config: Record<string, any>,
  schema: NodeSchema
): ValidationResult

/**
 * Get available node types for current mode
 */
export function getAvailableNodeTypes(mode: 'workflow' | 'architecture'): NodeType[]

/**
 * Check if two node types are compatible for connection
 */
export function areNodesCompatible(
  fromNode: WorkflowNode,
  fromOutput: NodeOutput,
  toNode: WorkflowNode,
  toInput: NodeInput
): boolean
```

### Layout Utilities

```typescript
/**
 * Auto-layout nodes using specified algorithm
 */
export function autoLayoutNodes(
  nodes: WorkflowNode[],
  connections: Connection[],
  algorithm: 'hierarchical' | 'force-directed' | 'grid'
): Record<string, Position>

/**
 * Align nodes to specified alignment
 */
export function alignNodes(
  nodes: WorkflowNode[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): Record<string, Position>

/**
 * Distribute nodes evenly in specified direction
 */
export function distributeNodes(
  nodes: WorkflowNode[],
  direction: 'horizontal' | 'vertical',
  spacing?: number
): Record<string, Position>

/**
 * Snap position to grid
 */
export function snapToGrid(position: Position, gridSize: number): Position
```

### Validation Utilities

```typescript
interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface ValidationError {
  field: string
  message: string
  code: string
}

interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

/**
 * Validate complete workflow
 */
export function validateWorkflow(workflow: Workflow): ValidationResult

/**
 * Validate node connections
 */
export function validateConnections(
  nodes: WorkflowNode[],
  connections: Connection[]
): ValidationResult

/**
 * Check for circular dependencies
 */
export function hasCircularDependency(
  nodes: WorkflowNode[],
  connections: Connection[]
): boolean

/**
 * Find all paths between two nodes
 */
export function findNodePaths(
  fromNodeId: string,
  toNodeId: string,
  connections: Connection[]
): string[][]
```

## 🎨 Styling & Theme API

### CSS Custom Properties

```css
/* Core color variables */
:root {
  /* Primary colors (mode-dependent) */
  --primary-50: #eff6ff;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  
  /* Glass effect variables */
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-blur: blur(10px);
  
  /* Canvas variables */
  --canvas-bg: #f8fafc;
  --canvas-grid: #e2e8f0;
  --canvas-grid-size: 20px;
  
  /* Node variables */
  --node-bg: var(--glass-bg);
  --node-border: var(--glass-border);
  --node-border-radius: 12px;
  --node-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  
  /* Connection variables */
  --connection-stroke: var(--primary-500);
  --connection-stroke-width: 2px;
  --connection-stroke-hover: var(--primary-600);
}

/* Mode-specific overrides */
:root[data-mode="architecture"] {
  --primary-500: #8b5cf6;
  --primary-600: #7c3aed;
}
```

### Theme Configuration

```typescript
interface Theme {
  colors: {
    primary: ColorScale
    secondary: ColorScale
    accent: ColorScale
    neutral: ColorScale
    success: ColorScale
    warning: ColorScale
    error: ColorScale
  }
  
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  
  typography: {
    fontFamily: {
      sans: string[]
      mono: string[]
    }
    fontSize: Record<string, [string, string]>
    fontWeight: Record<string, number>
  }
  
  borderRadius: {
    sm: string
    md: string
    lg: string
    xl: string
  }
  
  shadows: {
    sm: string
    md: string
    lg: string
    xl: string
  }
  
  glassmorphism: {
    primary: GlassStyle
    secondary: GlassStyle
    elevated: GlassStyle
  }
}

interface ColorScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
}

interface GlassStyle {
  background: string
  backdropFilter: string
  border: string
  borderRadius: string
  boxShadow?: string
}
```

## 🔧 Service APIs

### Workflow Service

```typescript
interface WorkflowService {
  // CRUD operations
  create(workflow: Partial<Workflow>): Promise<Workflow>
  get(id: string): Promise<Workflow>
  update(id: string, updates: Partial<Workflow>): Promise<Workflow>
  delete(id: string): Promise<void>
  list(filters?: WorkflowFilters): Promise<Workflow[]>
  
  // Execution
  execute(id: string, input?: any): Promise<ExecutionResult>
  stop(executionId: string): Promise<void>
  getExecution(executionId: string): Promise<WorkflowExecution>
  
  // Validation
  validate(workflow: Workflow): Promise<ValidationResult>
  
  // Templates
  getTemplates(): Promise<WorkflowTemplate[]>
  createFromTemplate(templateId: string, name: string): Promise<Workflow>
}
```

### WebSocket Service

```typescript
interface WebSocketService {
  // Connection management
  connect(): Promise<void>
  disconnect(): void
  isConnected(): boolean
  
  // Event subscription
  on(event: string, handler: (data: any) => void): void
  off(event: string, handler?: (data: any) => void): void
  
  // Workflow events
  subscribeToWorkflow(workflowId: string): void
  unsubscribeFromWorkflow(workflowId: string): void
  
  // Execution events
  subscribeToExecution(executionId: string): void
  unsubscribeFromExecution(executionId: string): void
  
  // Send messages
  send(message: WebSocketMessage): void
}
```

---

ยินดีต้อนรับสู่ f1ow Workflow Engine Frontend API Documentation! 

สำหรับข้อมูลเพิ่มเติมหรือคำถาม กรุณาดูเอกสารอื่นๆ ใน [docs directory](./README.md) หรือตรวจสอบ source code ที่มี comprehensive JSDoc comments
