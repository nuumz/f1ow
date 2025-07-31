# Workflow Designer with Provider

A comprehensive workflow designer implementation using React Context for state management.

## 🎯 Overview

The Workflow Designer has been enhanced with a Provider pattern that centralizes state management, making it easier to:
- Share state across multiple components
- Implement complex workflow operations
- Add custom hooks for specific functionality
- Maintain consistency across the application

## 📁 File Structure

```
workflow-designer/
├── contexts/
│   └── WorkflowContext.tsx        # Main context and provider
├── hooks/
│   ├── useWorkflowOperations.ts   # Core workflow operations
│   ├── useWorkflowCanvas.ts       # Canvas transformation utilities
│   └── useWorkflowEventHandlers.ts # Event handling logic
├── components/
│   └── WorkflowCanvas.tsx         # Canvas rendering component
├── WorkflowDesigner.tsx           # Original component (legacy)
├── WorkflowDesignerWithProvider.tsx # New component with provider
└── index.ts                       # Export definitions
```

## 🚀 Usage

### Basic Implementation

```tsx
import { WorkflowDesignerWithProvider } from './components/workflow-designer'

export default function App() {
  return (
    <div className="app">
      <WorkflowDesignerWithProvider />
    </div>
  )
}
```

### With Initial Workflow Data

```tsx
import { WorkflowDesignerWithProvider } from './components/workflow-designer'

const initialWorkflow = {
  name: "My Workflow",
  nodes: [
    {
      id: "node-1",
      type: "start",
      x: 100,
      y: 100,
      config: { name: "Start Node" }
    }
  ],
  connections: []
}

export default function App() {
  return (
    <WorkflowDesignerWithProvider initialWorkflow={initialWorkflow} />
  )
}
```

### Using Individual Components with Provider

```tsx
import { 
  WorkflowProvider, 
  useWorkflowContext,
  useWorkflowOperations 
} from './components/workflow-designer'

function CustomWorkflowComponent() {
  const { state } = useWorkflowContext()
  const operations = useWorkflowOperations()

  return (
    <div>
      <button onClick={() => operations.addNode('http')}>
        Add HTTP Node
      </button>
      <div>Nodes: {state.nodes.length}</div>
    </div>
  )
}

export default function App() {
  return (
    <WorkflowProvider>
      <CustomWorkflowComponent />
    </WorkflowProvider>
  )
}
```

## 🎛️ Available Hooks

### useWorkflowOperations

Core operations for managing workflows:

```tsx
const operations = useWorkflowOperations()

// Node operations
operations.addNode('http', { x: 100, y: 100 })
operations.updateNode('node-1', { config: { name: 'Updated' } })
operations.deleteNode('node-1')

// Connection operations
operations.createConnection('node-1', 'output-1', 'node-2', 'input-1')
operations.deleteConnection('connection-1')

// Selection operations
operations.selectNode('node-1', false)
operations.clearSelection()

// Workflow operations
operations.saveWorkflow()
operations.executeWorkflow()
operations.exportWorkflow()
```

### useWorkflowCanvas

Canvas transformation and navigation:

```tsx
const canvas = useWorkflowCanvas()

// Zoom operations
canvas.zoomIn()
canvas.zoomOut()
canvas.setZoomLevel(1.5)

// Navigation
canvas.fitToScreen()
canvas.resetCanvasPosition()

// Transform handling
canvas.saveCanvasTransform({ x: 0, y: 0, k: 1 })
```

### useWorkflowEventHandlers

Pre-configured event handlers:

```tsx
const handlers = useWorkflowEventHandlers()

// Use in components
<div 
  onDrop={handlers.handleCanvasDrop}
  onDragOver={handlers.handleCanvasDragOver}
>
  <WorkflowCanvas 
    onNodeClick={handlers.handleNodeClick}
    onConnectionClick={handlers.handleConnectionClick}
    // ... other handlers
  />
</div>
```

## 📊 State Management

### Core State Structure

```typescript
interface WorkflowState {
  // Core data
  workflowName: string
  nodes: WorkflowNode[]
  connections: Connection[]
  
  // Selection state
  selectedNodes: Set<string>
  selectedNode: WorkflowNode | null
  
  // Canvas state
  canvasTransform: CanvasTransform
  
  // Connection state
  connectionState: ConnectionState
  
  // Execution state
  executionState: ExecutionState
  
  // UI state
  uiState: UIState
}
```

### Available Actions

The provider supports comprehensive actions for all state mutations:

```typescript
// Node actions
dispatch({ type: 'ADD_NODE', payload: newNode })
dispatch({ type: 'UPDATE_NODE', payload: { nodeId: 'node-1', updates: {...} } })
dispatch({ type: 'DELETE_NODE', payload: 'node-1' })

// Selection actions
dispatch({ type: 'SELECT_NODE', payload: { nodeId: 'node-1', multiSelect: false } })
dispatch({ type: 'CLEAR_SELECTION' })

// Canvas actions
dispatch({ type: 'SET_CANVAS_TRANSFORM', payload: { x: 0, y: 0, k: 1 } })

// And many more...
```

## 🎨 Features

### ✅ State Management
- Centralized state with React Context
- Immutable state updates with reducer pattern
- Type-safe actions and state

### ✅ Performance Optimized
- Memoized context values
- Optimized re-renders
- Efficient state updates

### ✅ Developer Experience
- Comprehensive TypeScript support
- Custom hooks for common operations
- Clear separation of concerns

### ✅ Workflow Operations
- Node CRUD operations
- Connection management
- Canvas transformation
- Import/Export functionality
- Execution simulation

### ✅ UI Features
- Drag & drop support
- Multi-selection
- Keyboard shortcuts
- Visual feedback
- Real-time updates

## 🔧 Customization

### Custom Hooks

Create custom hooks that use the workflow context:

```tsx
function useWorkflowValidation() {
  const { state } = useWorkflowContext()
  
  const validateWorkflow = useCallback(() => {
    const issues = []
    
    // Check for orphaned nodes
    const connectedNodes = new Set()
    state.connections.forEach(conn => {
      connectedNodes.add(conn.sourceNodeId)
      connectedNodes.add(conn.targetNodeId)
    })
    
    const orphanedNodes = state.nodes.filter(node => 
      !connectedNodes.has(node.id) && node.type !== 'start'
    )
    
    if (orphanedNodes.length > 0) {
      issues.push(`Found ${orphanedNodes.length} orphaned nodes`)
    }
    
    return issues
  }, [state.nodes, state.connections])
  
  return { validateWorkflow }
}
```

### Custom Components

Build custom components that integrate with the workflow:

```tsx
function WorkflowMinimap() {
  const { state } = useWorkflowContext()
  const canvas = useWorkflowCanvas()
  
  return (
    <div className="workflow-minimap">
      <svg width="200" height="150">
        {state.nodes.map(node => (
          <circle
            key={node.id}
            cx={node.x * 0.1}
            cy={node.y * 0.1}
            r="3"
            fill="#333"
            onClick={() => canvas.focusOnNode(node)}
          />
        ))}
      </svg>
    </div>
  )
}
```

## 🔄 Migration from Legacy

To migrate from the original WorkflowDesigner:

1. **Replace the import:**
```tsx
// Before
import WorkflowDesigner from './components/workflow-designer/WorkflowDesigner'

// After
import { WorkflowDesignerWithProvider } from './components/workflow-designer'
```

2. **Update props (if any):**
```tsx
// Before
<WorkflowDesigner />

// After  
<WorkflowDesignerWithProvider initialWorkflow={initialData} />
```

3. **Use new hooks for custom functionality:**
```tsx
// Before - direct state manipulation
const [nodes, setNodes] = useState([])

// After - use provider hooks
const { state } = useWorkflowContext()
const operations = useWorkflowOperations()
```

## 📝 Type Definitions

All types are fully exported for use in your application:

```tsx
import type { 
  WorkflowState, 
  WorkflowAction, 
  ExecutionState,
  WorkflowNode,
  Connection
} from './components/workflow-designer'
```

## 🎯 Benefits

1. **Maintainability**: Clear separation of concerns with dedicated hooks
2. **Scalability**: Easy to extend with new features and components  
3. **Performance**: Optimized re-renders and state updates
4. **Developer Experience**: Comprehensive TypeScript support and clear APIs
5. **Testing**: Easy to test individual hooks and components
6. **Reusability**: Components can be reused across different parts of the application

The provider pattern makes the Workflow Designer more modular, maintainable, and easier to extend with new features!