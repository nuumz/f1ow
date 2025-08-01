# Architecture Overview - f1ow Workflow Engine Frontend

## 🏗️ System Architecture

f1ow Workflow Engine Frontend ใช้ modern React architecture ที่ออกแบบมาเพื่อความยืดหยุ่นและการขยายตัว

## 🎯 Core Architecture Patterns

### 1. Provider Pattern Architecture
```
WorkflowDesignerWithProvider
├── WorkflowContextProvider (State Management)
├── WorkflowDesigner (Main UI)
│   ├── Header (Navigation & Controls)
│   ├── Sidebar (Node Palette)
│   ├── Canvas (Main Work Area)
│   └── Properties Panel (Node Configuration)
└── Background Components (Utilities)
```

### 2. Unified Canvas Architecture (Refactored)

f1ow ใช้ **Unified Canvas Architecture** แทนการแยก components ออกจากกัน:

#### Unified Canvas Benefits
- **Single Canvas Implementation** - WorkflowCanvas serves both modes using Strategy Pattern
- **Eliminated Code Duplication** - ~200 lines of duplicate code removed
- **Consistent Behavior** - Shared D3.js instances and consistent zoom/pan state
- **Reduced Bundle Size** - 504.31 kB optimized build

#### Mode Separation

**Architecture Mode** 🏗️ - System design และ documentation
**Workflow Mode** ⚙️ - Process automation และ execution

## 🧩 Component Hierarchy

### Core Components

#### WorkflowDesigner.tsx
```typescript
interface WorkflowDesignerProps {
  workflow?: Workflow
  mode?: 'workflow' | 'architecture'
  readOnly?: boolean
}
```
- **บทบาท**: Main container และ orchestration
- **รับผิดชอบ**: Layout, mode switching, context coordination
- **Dependencies**: WorkflowContext, useWorkflowCanvas

#### WorkflowContext.tsx
```typescript
interface WorkflowContextType {
  // State Management
  state: WorkflowState
  dispatch: WorkflowDispatch
  
  // Canvas Operations
  isDragging: () => boolean
  startDragging: (nodeId: string, position: Position) => void
  endDragging: () => void
  
  // Node Operations
  addNode: (node: WorkflowNode) => void
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  deleteNode: (nodeId: string) => void
}
```
- **บทบาท**: Centralized state management
- **รับผิดชอบ**: State coordination, action dispatch
- **Pattern**: Context + useReducer architecture

#### Node Palette System
```typescript
interface NodePaletteProps {
  mode: 'workflow' | 'architecture'
  categories: NodeCategory[]
  onNodeDrag: (nodeType: string) => void
}
```
- **บทบาท**: Node creation และ management
- **รับผิดชอบ**: Node library, drag initiation
- **Design**: Unified 22 node types per mode

### Canvas & Rendering

#### WorkflowCanvas.tsx
```typescript
interface CanvasProps {
  nodes: WorkflowNode[]
  connections: Connection[]
  onNodeMove: (nodeId: string, position: Position) => void
  onConnection: (from: string, to: string) => void
}
```
- **บทบาท**: Main drawing surface
- **รับผิดชอบ**: Node rendering, connection drawing
- **Technology**: D3.js integration

#### useWorkflowCanvas Hook
```typescript
interface CanvasControls {
  zoomIn: () => void
  zoomOut: () => void
  resetCanvasPosition: () => void
  fitToScreen: () => void
}
```
- **บทบาท**: Canvas behavior management
- **รับผิดชอบ**: Zoom, pan, fit operations
- **Logic**: Conditional reset (1 node = center, >1 nodes = 30%/40%)

## 🔄 Data Flow Architecture

### State Management Flow
```
User Action → Component Event → Context Dispatch → Reducer Update → Re-render
```

### Canvas Interaction Flow
```
User Interaction → D3 Event → Canvas Hook → Context Update → Visual Update
```

### Node Lifecycle Flow
```
Palette Drag → Canvas Drop → Node Creation → Context State → Canvas Render
```

## 🎨 Design System Integration

### Glassmorphism Effects
```css
.glassmorphism {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

### Responsive Design Strategy
- **Mobile First**: Base styles for mobile
- **Progressive Enhancement**: Desktop features added
- **Breakpoints**: 768px (tablet), 1024px (desktop)

### Icon System
- **Library**: Lucide React icons
- **Sizes**: 16px (standard), 20px (large), 12px (small)
- **Consistency**: Same icon families across modes

## ⚡ Performance Architecture

### Performance Strategies
- **React Optimization** - Component memoization และ useMemo สำหรับ expensive calculations
- **D3.js Optimization** - Throttled updates (~60fps) และ efficient canvas manipulation  
- **Canvas Performance** - Virtualization, batch updates, smart re-rendering
- **Memory Management** - Event cleanup, reference management, LRU cache

## 🧪 Testing Architecture

### Testing Strategy
```
Unit Tests → Integration Tests → E2E Tests
```

### Component Testing
- **React Testing Library**: Component behavior testing
- **Jest**: Unit test framework
- **MSW**: API mocking for integration tests

### Canvas Testing
- **D3 Testing**: Mock D3 behaviors
- **Interaction Testing**: Simulate drag/drop operations
- **Visual Regression**: Screenshot comparison tests

## 🔗 External Integrations

### Backend Communication
```typescript
interface ApiClient {
  workflows: WorkflowApi
  nodes: NodeApi
  execution: ExecutionApi
  websocket: WebSocketService
}
```

### WebSocket Integration
- **Real-time Updates**: Workflow execution status
- **Collaborative Editing**: Multi-user support
- **Event Broadcasting**: System notifications

## 🛠️ Development Architecture

### Build System
- **Vite**: Fast development server
- **TypeScript**: Type safety and IDE support
- **ESLint/Prettier**: Code quality tools

### Module Structure
```
src/
├── components/           # React components
├── contexts/            # Context providers
├── hooks/               # Custom hooks
├── services/            # API and external services
├── types/               # TypeScript definitions
├── utils/               # Utility functions
└── styles/              # Global styles
```

### Code Organization Principles
- **Feature-based**: Group by functionality
- **Separation of Concerns**: Clear responsibilities
- **Reusability**: Shared components and utilities
- **Maintainability**: Clear interfaces and documentation

---

**Next**: [Component System](./02-component-system.md) - Deep dive into individual components
