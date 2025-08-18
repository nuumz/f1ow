# Workflow Designer with Provider

A comprehensive visual workflow designer implementation featuring adaptive connection routing, multiple view modes, and real-time collaboration capabilities.

## 🎯 Overview

The Workflow Designer is a modern, feature-rich visual editor for building and managing complex workflows. It includes:

### ✨ **Latest Features (2025)**

- **Adaptive Connection Routing**: Smart path generation for nearby nodes with 25% proportional leads
- **Architecture Mode**: Orthogonal connections with rounded corners for system diagrams
- **Real-time Preview**: Live connection preview with hover target detection
- **Multiple View Modes**: Switch between workflow and architecture visualization modes
- **Enhanced Performance**: Optimized rendering with D3.js integration and grid performance monitoring

### 🏗️ **Core Capabilities**

- **Provider Pattern**: Centralized state management using React Context
- **Visual Canvas**: SVG-based drawing surface with zoom, pan, and grid support
- **Node System**: Drag-and-drop node creation with type validation
- **Smart Connections**: Automatic path routing with obstacle avoidance
- **Multi-selection**: Select and manipulate multiple nodes simultaneously
- **Real-time Updates**: Live collaboration and state synchronization

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
│   └── WorkflowCanvas.tsx         # Main canvas rendering component (52k+ lines)
├── utils/
│   ├── connection-utils.ts        # Connection path generation and management
│   ├── path-generation.ts         # Advanced path algorithms with adaptive routing
│   ├── node-utils.ts             # Node positioning and shape utilities
│   ├── canvas-utils.ts           # Canvas transformation and viewport utilities
│   └── performance-monitor.ts    # Performance optimization for large workflows
├── modes/
│   └── README.md                 # Multi-mode system documentation
├── WorkflowDesigner.tsx           # Original component (legacy)
├── WorkflowDesignerWithProvider.tsx # New component with provider
└── index.ts                       # Export definitions
```

## 🖼️ WorkflowCanvas Component

The `WorkflowCanvas` is the core rendering component that handles all visual aspects of the workflow designer:

### **Key Features**

#### 🎨 **Visual Rendering**

- **SVG-based Architecture**: High-performance vector graphics for scalability
- **D3.js Integration**: Advanced data visualization and interaction handling
- **Multi-layer System**: Separate layers for grid, connections, nodes, and UI elements
- **Dynamic Styling**: Context-aware colors, shapes, and visual feedback

#### 🔗 **Advanced Connection System**

- **Adaptive Path Generation**: Smart routing that adjusts for node proximity
  ```typescript
  // Nearby nodes (< 100px apart) use proportional leads
  const adaptiveFixed = totalDistance < 100 ? totalDistance * 0.25 : 50;
  ```
- **Multiple Path Types**: Bezier curves, orthogonal, and architectural routing
- **Real-time Preview**: Live connection preview with hover detection
- **Obstacle Avoidance**: Automatic path adjustment around nodes and boundaries

#### 🏗️ **Architecture Mode**

- **Orthogonal Connections**: Right-angle paths with rounded corners
- **Virtual Side Ports**: Dynamic port positioning (`__side-top`, `__side-bottom`, etc.)
- **Proximity Rules**: Smart attachment point selection based on node distance
  ```typescript
  // Architecture rule: < 30px horizontal distance → bottom attachment
  const attachBottom = Math.abs(targetX - sourceX) < 30;
  ```

#### 🎯 **Node Management**

- **Shape-aware Positioning**: Automatic port positioning based on node geometry
- **Multi-selection Support**: Rubber band selection and group operations
- **Drag & Drop**: Smooth node movement with snap-to-grid and collision detection
- **Z-index Management**: Dynamic layering for selected, dragging, and normal states

#### ⚡ **Performance Optimizations**

- **Grid Performance Monitoring**: Automatic optimization for large workflows
- **Viewport Culling**: Only render visible elements during zoom/pan
- **Memoized Calculations**: Cached path generation and position calculations
- **Debounced Updates**: Throttled re-renders during intensive operations

## 🚀 Usage

### Basic Implementation

```tsx
import { WorkflowDesignerWithProvider } from './components/workflow-designer';

export default function App() {
  return (
    <div className="app">
      <WorkflowDesignerWithProvider
        enableArchitectureMode={true}
        showGrid={true}
        optimizeForLargeWorkflows={true}
      />
    </div>
  );
}
```

### Advanced Canvas Configuration

```tsx
import { WorkflowCanvas } from './components/workflow-designer';
import { useWorkflowContext } from './components/workflow-designer/contexts';

function CustomWorkflowEditor() {
  const { state, dispatch } = useWorkflowContext();
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <WorkflowCanvas
      svgRef={svgRef}
      nodes={state.nodes}
      connections={state.connections}
      // Canvas configuration
      showGrid={true}
      canvasTransform={state.canvasTransform}
      nodeVariant="standard" // or "compact", "detailed"
      // Selection state
      selectedNodes={state.selectedNodes}
      selectedConnection={state.selectedConnection}
      isNodeSelected={(id) => state.selectedNodes.has(id)}
      // Connection state with new adaptive routing
      isConnecting={state.connectionState.isConnecting}
      connectionStart={state.connectionState.connectionStart}
      connectionPreview={state.connectionState.preview}
      // Event handlers with enhanced capabilities
      onNodeClick={(node, ctrlKey) => {
        dispatch({
          type: 'SELECT_NODE',
          payload: { nodeId: node.id, multiSelect: ctrlKey },
        });
      }}
      onConnectionClick={(connection) => {
        dispatch({
          type: 'SELECT_CONNECTION',
          payload: connection,
        });
      }}
      // Advanced port interaction
      onPortClick={(nodeId, portId, portType) => {
        // Starts connection with adaptive preview
        dispatch({
          type: 'START_CONNECTION',
          payload: { nodeId, portId, portType },
        });
      }}
      // Drag & drop with proximity detection
      onPortDragEnd={(targetNodeId, targetPortId, canvasX, canvasY) => {
        // Creates connection with optimal path routing
        if (targetNodeId && targetPortId) {
          dispatch({
            type: 'CREATE_CONNECTION',
            payload: { targetNodeId, targetPortId },
          });
        }
      }}
    />
  );
}
```

### Architecture Mode Usage

```tsx
import { useWorkflowContext } from './components/workflow-designer';

function ArchitectureModeExample() {
  const { state, operations } = useWorkflowContext();

  // Enable architecture mode for system diagrams
  useEffect(() => {
    operations.setDesignerMode('architecture');
  }, []);

  // Architecture mode features:
  // - Orthogonal connections with rounded corners
  // - Virtual side ports (__side-top, __side-bottom, etc.)
  // - Smart proximity-based attachment (< 30px = bottom attachment)
  // - Adaptive lead lengths for nearby nodes

  return (
    <div className="architecture-workflow">
      <WorkflowCanvas
        // ... props
        nodeVariant="architectural" // Optimized for system diagrams
      />
    </div>
  );
}
```

### With Initial Workflow Data

```tsx
import { WorkflowDesignerWithProvider } from './components/workflow-designer';

const initialWorkflow = {
  name: 'My Workflow',
  nodes: [
    {
      id: 'node-1',
      type: 'start',
      x: 100,
      y: 100,
      config: { name: 'Start Node' },
    },
  ],
  connections: [],
};

export default function App() {
  return <WorkflowDesignerWithProvider initialWorkflow={initialWorkflow} />;
}
```

### Using Individual Components with Provider

```tsx
import {
  WorkflowProvider,
  useWorkflowContext,
  useWorkflowOperations,
} from './components/workflow-designer';

function CustomWorkflowComponent() {
  const { state } = useWorkflowContext();
  const operations = useWorkflowOperations();

  return (
    <div>
      <button onClick={() => operations.addNode('http')}>Add HTTP Node</button>
      <div>Nodes: {state.nodes.length}</div>
    </div>
  );
}

export default function App() {
  return (
    <WorkflowProvider>
      <CustomWorkflowComponent />
    </WorkflowProvider>
  );
}
```

## 🔗 Advanced Connection System

The workflow designer includes a sophisticated connection routing system with adaptive algorithms:

### **Connection Path Algorithms**

#### 1. **Adaptive Lead Length Calculation**

```typescript
// Smart lead length for nearby nodes
function getAdaptiveLeadLength(totalDistance: number, requestedFixed: number): number {
  if (totalDistance < requestedFixed * 2) {
    // Use 25% of total distance for each lead, minimum 10px
    return Math.max(10, totalDistance * 0.25);
  }
  return requestedFixed; // Standard 50px for normal spacing
}
```

#### 2. **Architecture Mode Routing**

```typescript
// Proximity-based attachment rules
const generateArchitectureConnection = (sourceNode, targetNode) => {
  const dx = targetNode.x - sourceNode.x;

  // For bottom ports: < 30px apart → attach to bottom, else top
  const targetSide = isSourceBottomPort && Math.abs(dx) < 30 ? '__side-bottom' : '__side-top';

  return generateAdaptiveOrthogonalPath(sourcePos, targetPos, {
    startOrientation: 'vertical',
    endOrientation: 'vertical',
    clearance: 10,
  });
};
```

#### 3. **Real-time Preview**

```typescript
// Live connection preview with hover detection
const calculateConnectionPreview = (sourceNode, mousePos, hoverTarget) => {
  if (architectureMode && hoverTarget) {
    // Snap to target's edge based on proximity
    const targetCenter = hoverTarget.x + hoverTarget.width / 2;
    const previewEnd =
      Math.abs(targetCenter - sourceNode.x) < 30
        ? { x: targetCenter, y: hoverTarget.y + hoverTarget.height } // bottom
        : { x: targetCenter, y: hoverTarget.y }; // top

    return generateAdaptiveOrthogonalPath(sourcePos, previewEnd);
  }

  return generatePreviewPath(sourcePos, mousePos); // Curved preview
};
```

### **Connection Features**

#### ✨ **Smart Path Generation**

- **Nearby Node Detection**: Automatically adjusts path for nodes < 100px apart
- **Proportional Leads**: Uses 25% of available distance for tight spacing
- **Minimum Clearance**: Ensures 10px minimum lead length for visibility
- **Obstacle Avoidance**: Routes around nodes and boundaries

#### 🏗️ **Architecture Mode**

- **Orthogonal Paths**: Right-angle connections with rounded corners
- **Virtual Ports**: Dynamic side port positioning (`__side-*`)
- **Proximity Rules**: Smart attachment based on 30px threshold
- **Bottom-to-Bottom**: Special routing for closely spaced vertical flows

#### ⚡ **Performance**

- **Memoized Calculations**: Cached path generation for repeated connections
- **Optimized Algorithms**: Efficient pathfinding with minimal CPU usage
- **Viewport Culling**: Only process visible connections during interactions

### **Usage Examples**

#### Custom Connection Validation

```typescript
const useConnectionValidation = () => {
  const canCreateConnection = useCallback(
    (
      sourceNode: WorkflowNode,
      sourcePort: string,
      targetNode: WorkflowNode,
      targetPort: string
    ) => {
      // Prevent self-connections
      if (sourceNode.id === targetNode.id) return false;

      // Check type compatibility
      const sourceOutput = sourceNode.outputs.find((p) => p.id === sourcePort);
      const targetInput = targetNode.inputs.find((p) => p.id === targetPort);

      if (!sourceOutput || !targetInput) return false;

      // Type system validation
      return isTypeCompatible(sourceOutput.type, targetInput.type);
    },
    []
  );

  return { canCreateConnection };
};
```

#### Custom Path Styling

```typescript
const useConnectionStyling = () => {
  const getConnectionStyle = useCallback((connection: Connection) => {
    const groupInfo = getConnectionGroupInfo(connection.id, allConnections);

    return {
      stroke: connection.selected ? '#0066cc' : '#666',
      strokeWidth: groupInfo.isMultiple ? 3 : 2,
      strokeDasharray: connection.conditional ? '5,5' : 'none',
      opacity: connection.disabled ? 0.5 : 1,
    };
  }, []);

  return { getConnectionStyle };
};
```

## 🎛️ Available Hooks

### useWorkflowOperations

Core operations for managing workflows:

```tsx
const operations = useWorkflowOperations();

// Node operations
operations.addNode('http', { x: 100, y: 100 });
operations.updateNode('node-1', { config: { name: 'Updated' } });
operations.deleteNode('node-1');

// Connection operations
operations.createConnection('node-1', 'output-1', 'node-2', 'input-1');
operations.deleteConnection('connection-1');

// Selection operations
operations.selectNode('node-1', false);
operations.clearSelection();

// Workflow operations
operations.saveWorkflow();
operations.executeWorkflow();
operations.exportWorkflow();
```

### useWorkflowCanvas

Canvas transformation and navigation:

```tsx
const canvas = useWorkflowCanvas();

// Zoom operations
canvas.zoomIn();
canvas.zoomOut();
canvas.setZoomLevel(1.5);

// Navigation
canvas.fitToScreen();
canvas.resetCanvasPosition();

// Transform handling
canvas.saveCanvasTransform({ x: 0, y: 0, k: 1 });
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
  workflowName: string;
  nodes: WorkflowNode[];
  connections: Connection[];

  // Selection state
  selectedNodes: Set<string>;
  selectedNode: WorkflowNode | null;

  // Canvas state
  canvasTransform: CanvasTransform;

  // Connection state
  connectionState: ConnectionState;

  // Execution state
  executionState: ExecutionState;

  // UI state
  uiState: UIState;
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
  const { state } = useWorkflowContext();

  const validateWorkflow = useCallback(() => {
    const issues = [];

    // Check for orphaned nodes
    const connectedNodes = new Set();
    state.connections.forEach((conn) => {
      connectedNodes.add(conn.sourceNodeId);
      connectedNodes.add(conn.targetNodeId);
    });

    const orphanedNodes = state.nodes.filter(
      (node) => !connectedNodes.has(node.id) && node.type !== 'start'
    );

    if (orphanedNodes.length > 0) {
      issues.push(`Found ${orphanedNodes.length} orphaned nodes`);
    }

    return issues;
  }, [state.nodes, state.connections]);

  return { validateWorkflow };
}
```

### Custom Components

Build custom components that integrate with the workflow:

```tsx
function WorkflowMinimap() {
  const { state } = useWorkflowContext();
  const canvas = useWorkflowCanvas();

  return (
    <div className="workflow-minimap">
      <svg width="200" height="150">
        {state.nodes.map((node) => (
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
  );
}
```

## 🔄 Migration from Legacy

To migrate from the original WorkflowDesigner:

1. **Replace the import:**

```tsx
// Before
import WorkflowDesigner from './components/workflow-designer/WorkflowDesigner';

// After
import { WorkflowDesignerWithProvider } from './components/workflow-designer';
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
const [nodes, setNodes] = useState([]);

// After - use provider hooks
const { state } = useWorkflowContext();
const operations = useWorkflowOperations();
```

## 📝 Type Definitions

All types are fully exported for use in your application:

```tsx
import type {
  WorkflowState,
  WorkflowAction,
  ExecutionState,
  WorkflowNode,
  Connection,
} from './components/workflow-designer';
```

## 🎯 Benefits

### 🚀 **2025 Feature Improvements**

1. **Adaptive Connection Routing**: Intelligent path generation for complex workflows
2. **Architecture Mode**: Professional system diagram capabilities
3. **Enhanced Performance**: Optimized for large-scale workflows (1000+ nodes)
4. **Real-time Collaboration**: Live updates and conflict resolution
5. **Advanced Visual Feedback**: Proximity detection and smart previews

### 🏗️ **Technical Architecture**

1. **Maintainability**: Modular architecture with dedicated utility modules
2. **Scalability**: Performance-optimized for enterprise-scale workflows
3. **Performance**: Advanced caching, memoization, and viewport optimization
4. **Developer Experience**: Comprehensive TypeScript support with 50+ interfaces
5. **Testing**: Isolated, testable components with mock-friendly APIs
6. **Extensibility**: Plugin-based architecture for custom node types and behaviors

### 📊 **Production Ready**

- **Tested at Scale**: Handles workflows with 1000+ nodes smoothly
- **Memory Efficient**: Optimized rendering with viewport culling
- **Type Safe**: Full TypeScript coverage with strict typing
- **Accessible**: WCAG 2.1 compliant with keyboard navigation
- **Cross-browser**: Tested on Chrome, Firefox, Safari, Edge
- **Mobile Ready**: Responsive design with touch gesture support

## 🔄 Recent Updates (2025)

### **v3.0 - Advanced Connection System**

- ✅ Adaptive lead length calculation for nearby nodes
- ✅ Architecture mode with orthogonal routing
- ✅ Real-time connection preview with hover detection
- ✅ Virtual side port system for flexible attachments
- ✅ Performance optimizations for large workflows

### **v2.5 - Enhanced Canvas**

- ✅ Grid performance monitoring and optimization
- ✅ Multi-layer rendering system
- ✅ Advanced zoom and pan controls
- ✅ Shape-aware node positioning
- ✅ Dynamic z-index management

### **v2.0 - Provider Architecture**

- ✅ React Context-based state management
- ✅ Custom hooks for workflow operations
- ✅ Modular component architecture
- ✅ TypeScript-first development
- ✅ Comprehensive testing coverage

The Workflow Designer continues to evolve as a world-class visual workflow editor, combining modern React patterns with advanced computational geometry for unparalleled user experience!
