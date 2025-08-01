# Component System - f1ow Workflow Engine Frontend

## 🧩 Component Architecture

f1ow ใช้ modular component architecture ที่แบ่งระบบออกเป็น layers ที่ชัดเจนและสามารถนำกลับมาใช้ได้

## 🎯 Core Component Layers

### 1. Provider Layer (Context Management)

#### WorkflowContextProvider
```typescript
interface WorkflowContextType {
  // State
  state: WorkflowState
  dispatch: React.Dispatch<WorkflowAction>
  
  // Canvas State
  draggingState: DraggingState
  selectedNodeId: string | null
  
  // Canvas Operations
  isDragging: () => boolean
  getDraggedNodeId: () => string | null
  startDragging: (nodeId: string, position: Position) => void
  endDragging: () => void
  
  // Node Operations
  addNode: (node: WorkflowNode) => void
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  deleteNode: (nodeId: string) => void
  selectNode: (nodeId: string | null) => void
}
```

**จุดประสงค์**: Centralized state management สำหรับทั้งระบบ
**Key Features**:
- **Stale Closure Prevention**: ใช้ currentStateRef เพื่อป้องกัน stale closures ใน D3 callbacks
- **Dragging Coordination**: จัดการ dragging state ระหว่าง React และ D3
- **Action Dispatch**: Centralized actions สำหรับ state mutations

### 2. Container Layer (Main Components)

#### WorkflowDesigner
```typescript
interface WorkflowDesignerProps {
  workflow?: Workflow
  mode?: 'workflow' | 'architecture' 
  readOnly?: boolean
  onSave?: (workflow: Workflow) => void
  onExecute?: (workflow: Workflow) => void
}
```

**จุดประสงค์**: Main application container
**Structure**:
```jsx
<div className="workflow-designer">
  <Header>
    <ArchitectureDropdown />
    <ActionButtons />
  </Header>
  
  <div className="workflow-content">
    <Sidebar>
      <NodePalette />
    </Sidebar>
    
    <MainCanvas>
      <CanvasToolbar />
      <WorkflowCanvas />
    </MainCanvas>
    
    <PropertiesPanel />
  </div>
</div>
```

**Key Features**:
- **Responsive Layout**: Adaptive layout สำหรับหน้าจอต่างขนาด
- **Mode Switching**: Toggle ระหว่าง workflow และ architecture modes
- **Toolbar Integration**: Header dropdown แทน standalone toolbar

### 3. Interaction Layer (Canvas & Controls)

#### WorkflowCanvas
```typescript
interface WorkflowCanvasProps {
  nodes: WorkflowNode[]
  connections: Connection[]
  mode: 'workflow' | 'architecture'
  readOnly?: boolean
}
```

**จุดประสงค์**: Main drawing surface พร้อม D3.js integration
**D3 Integration Pattern**:
```typescript
// Prevent stale closures
const currentStateRef = useRef(state)
currentStateRef.current = state

// D3 event handlers with fresh state access
function dragStarted(event: any, d: WorkflowNode) {
  const currentState = currentStateRef.current
  if (!currentState.draggingState.isDragging) {
    startDragging(d.id, { x: event.x, y: event.y })
  }
}
```

**Canvas Operations**:
- **Node Rendering**: SVG-based node visualization
- **Connection Drawing**: Dynamic path calculation
- **Interaction Handling**: Drag, drop, selection events
- **Zoom & Pan**: D3 zoom behavior integration

#### CanvasToolbar
```typescript
interface CanvasToolbarProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFit: () => void
  currentZoom?: number
}
```

**จุดประสงค์**: Canvas manipulation controls
**Features**:
- **Zoom Controls**: In/Out with 16px icons for better visibility
- **Reset Logic**: Conditional positioning (1 node = center, >1 nodes = 30%/40%)
- **Fit to Screen**: Auto-fit all content with center alignment
- **Glassmorphism UI**: Modern backdrop-filter effects

### 4. Content Layer (Node Management)

#### NodePalette (Unified Design System)
```typescript
interface NodePaletteProps {
  mode: 'workflow' | 'architecture'
  searchTerm?: string
  selectedCategory?: string
  onNodeDrag: (nodeType: string) => void
  showCategories?: boolean
  searchEnabled?: boolean
  nodeRenderer?: (node: NodeType) => React.ReactNode
}
```

**จุดประสงค์**: Unified node library สำหรับทั้ง 2 modes ที่ปรับปรุงแล้ว
**Complete Unified Design System**:

**สิ่งที่ทำสำเร็จ**:
- **BaseNodePalette.tsx**: Component พื้นฐานที่ใช้ร่วมกันระหว่าง modes
- **BaseNodePalette.css**: Design system ที่สมบูรณ์พร้อม modern UI, animations, responsive design
- **Icon System**: ใช้ icon wrapper functions เพื่อ type safety และ consistency
- **WorkflowNodePalette.tsx**: Node palette สำหรับ workflow automation พร้อม 22 node types
- **ArchitectureNodePalette.tsx**: Node palette สำหรับ architecture diagrams พร้อม 22 component types
- **Legacy Compatibility**: NodePalette.tsx เดิมยังใช้งานได้โดย redirect ไป WorkflowNodePalette

**Enhanced Features**:
```typescript
// Search & Filter System
- Real-time search across node names and descriptions
- Category-based filtering (8 categories each)
- Dynamic results with "No results" state

// Enhanced UX
- Drag & drop support with visual feedback
- Keyboard navigation (Enter/Space)
- Accessibility compliance (ARIA labels, focus management)
- Hover states with smooth animations

// Mode-Specific Design
- Workflow: automation-focused icons and categories
- Architecture: infrastructure-focused components
- Consistent visual language across both modes
```

**Unified Design System**:

**Workflow Nodes (22 types)**:
```typescript
const workflowNodes = [
  // Core Processing
  { type: 'start', category: 'control', icon: 'Play' },
  { type: 'end', category: 'control', icon: 'Square' },
  { type: 'http', category: 'integration', icon: 'Globe' },
  { type: 'transform', category: 'processing', icon: 'Zap' },
  
  // Control Flow
  { type: 'if', category: 'logic', icon: 'GitBranch' },
  { type: 'switch', category: 'logic', icon: 'GitMerge' },
  { type: 'loop', category: 'control', icon: 'RotateCcw' },
  { type: 'parallel', category: 'control', icon: 'Share2' },
  
  // Data Operations
  { type: 'filter', category: 'processing', icon: 'Filter' },
  { type: 'aggregate', category: 'processing', icon: 'BarChart3' },
  { type: 'validate', category: 'validation', icon: 'CheckCircle' },
  { type: 'delay', category: 'control', icon: 'Clock' },
  
  // Integration
  { type: 'webhook', category: 'integration', icon: 'Webhook' },
  { type: 'email', category: 'notification', icon: 'Mail' },
  { type: 'sms', category: 'notification', icon: 'MessageCircle' },
  { type: 'slack', category: 'notification', icon: 'Slack' },
  
  // Storage
  { type: 'database', category: 'storage', icon: 'Database' },
  { type: 'file', category: 'storage', icon: 'FileText' },
  { type: 'cache', category: 'storage', icon: 'HardDrive' },
  
  // Advanced
  { type: 'script', category: 'advanced', icon: 'Code' },
  { type: 'template', category: 'advanced', icon: 'Layout' },
  { type: 'custom', category: 'advanced', icon: 'Settings' }
]
```

**Architecture Nodes (22 types)**:
```typescript
const architectureNodes = [
  // Services
  { type: 'microservice', category: 'services', icon: 'Package' },
  { type: 'api-gateway', category: 'services', icon: 'Router' },
  { type: 'load-balancer', category: 'infrastructure', icon: 'Scale' },
  { type: 'service-mesh', category: 'services', icon: 'Network' },
  
  // Data Stores
  { type: 'postgres', category: 'databases', icon: 'Database' },
  { type: 'redis', category: 'databases', icon: 'Zap' },
  { type: 'elasticsearch', category: 'databases', icon: 'Search' },
  { type: 'mongodb', category: 'databases', icon: 'Layers' },
  
  // Infrastructure
  { type: 'kubernetes', category: 'infrastructure', icon: 'Box' },
  { type: 'docker', category: 'infrastructure', icon: 'Package2' },
  { type: 'vpc', category: 'infrastructure', icon: 'Shield' },
  { type: 'cdn', category: 'infrastructure', icon: 'Globe2' },
  
  // Messaging
  { type: 'message-queue', category: 'messaging', icon: 'MessageSquare' },
  { type: 'event-bus', category: 'messaging', icon: 'Radio' },
  { type: 'kafka', category: 'messaging', icon: 'Rss' },
  { type: 'rabbitmq', category: 'messaging', icon: 'Rabbit' },
  
  // Security
  { type: 'auth-service', category: 'security', icon: 'Lock' },
  { type: 'firewall', category: 'security', icon: 'Shield' },
  { type: 'ssl-termination', category: 'security', icon: 'Key' },
  
  // Monitoring
  { type: 'monitoring', category: 'observability', icon: 'Activity' },
  { type: 'logging', category: 'observability', icon: 'FileText' },
  { type: 'metrics', category: 'observability', icon: 'BarChart' }
]
```

**Categories ที่รองรับ**:

**Workflow Mode (8 categories)**:
- Flow Control, Data Operations, External Services
- Database, AI & ML, Scheduling, Security, System

**Architecture Mode (8 categories)**:
- Infrastructure, Services, Cloud, Security
- External, Clients, Data Flow, Documentation

**Technical Improvements**:
- **Type Safety**: Proper TypeScript interfaces และ icon typing
- **Performance**: useMemo optimization, minimal re-renders
- **Maintainability**: Single source of truth, DRY principles
- **Accessibility**: Full keyboard support, screen reader friendly
- **Modern UI Elements**: Clean, minimalist design with proper spacing
- **Interactive Elements**: Search, categories dropdown, hover states, empty states

**Integration Pattern**:
```typescript
// Automatic mode switching in WorkflowDesigner
{state.designerMode === 'workflow' ? (
  <WorkflowNodePalette onAddNode={operations.addNode} />
) : (
  <ArchitectureNodePalette onAddNode={handleAddArchitectureNode} />
)}

// Backward Compatibility maintained
import NodePalette from '../NodePalette'  // ✅ Still works
```

#### Node Components
```typescript
interface NodeComponentProps {
  node: WorkflowNode
  selected?: boolean
  readOnly?: boolean
  onUpdate?: (updates: Partial<WorkflowNode>) => void
  onDelete?: () => void
}
```

**จุดประสงค์**: Individual node rendering และ interaction
**Node Types**:
- **BaseNode**: Abstract base class สำหรับ common functionality
- **ConditionalNode**: Logic branching with condition editors
- **HTTPNode**: API integration with request/response handling
- **TransformNode**: Data transformation with expression editors

## 🎨 UI Component Layer

### Layout Components

#### Header
```typescript
interface HeaderProps {
  mode: 'workflow' | 'architecture'
  onModeChange: (mode: string) => void
  onSave?: () => void
  onExecute?: () => void
}
```

**Features**:
- **Architecture Dropdown**: แทน standalone toolbar
- **Action Buttons**: Save, Execute, Settings
- **Mode Indicator**: Visual feedback สำหรับ current mode

#### Sidebar
```typescript
interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  children: React.ReactNode
}
```

**Features**:
- **Collapsible**: Auto-collapse บน mobile
- **Resizable**: ปรับขนาดได้ด้วย drag handle
- **Responsive**: แสดงเป็น overlay บน screen เล็ก

### Form Components

#### NodeEditor
```typescript
interface NodeEditorProps {
  node: WorkflowNode | null
  schema: NodeSchema
  onUpdate: (updates: Partial<WorkflowNode>) => void
}
```

**Features**:
- **Dynamic Forms**: สร้าง form จาก JSON schema
- **Validation**: Real-time validation ด้วย schema rules
- **Rich Editors**: Code editor, expression editor สำหรับ advanced fields

#### ExpressionEditor
```typescript
interface ExpressionEditorProps {
  value: string
  onChange: (value: string) => void
  context?: Record<string, any>
  language?: 'javascript' | 'json' | 'yaml'
}
```

**Features**:
- **Syntax Highlighting**: Monaco editor integration
- **Auto-completion**: Context-aware suggestions
- **Validation**: Real-time syntax checking

## 🔄 Component Communication Patterns

### Data Flow Patterns
```
Parent → Props → Child (Downward)
Child → Callback → Parent (Upward)
Context → useContext → Component (Cross-cutting)
```

### Event Handling Patterns
```typescript
// Canvas event → Hook → Context → Global state
const handleNodeDrag = useCallback((nodeId: string, position: Position) => {
  updateNode(nodeId, { position })
}, [updateNode])

// Component event → Local state → Parent callback
const handleFormChange = useCallback((field: string, value: any) => {
  setLocalState(prev => ({ ...prev, [field]: value }))
  onUpdate({ [field]: value })
}, [onUpdate])
```

### State Coordination
- **Local State**: Component-specific UI state
- **Context State**: Shared application state
- **Derived State**: Computed values from context
- **External State**: API data และ cache

## 🧪 Component Testing Strategy

### Unit Testing
```typescript
describe('NodePalette', () => {
  it('should filter nodes by search term', () => {
    render(<NodePalette mode="workflow" searchTerm="http" />)
    expect(screen.getByText('HTTP Request')).toBeInTheDocument()
    expect(screen.queryByText('Database')).not.toBeInTheDocument()
  })
})
```

### Integration Testing
```typescript
describe('WorkflowDesigner Integration', () => {
  it('should coordinate drag and drop between palette and canvas', () => {
    const { palette, canvas } = renderWorkflowDesigner()
    
    fireEvent.dragStart(palette.getByText('HTTP Request'))
    fireEvent.drop(canvas.getByTestId('canvas-area'))
    
    expect(canvas.getByTestId('http-node')).toBeInTheDocument()
  })
})
```

---

**Next**: [Design System](./03-design-system.md) - UI/UX guidelines และ styling approach
