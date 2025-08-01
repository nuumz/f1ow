# Development Guide - f1ow Workflow Engine Frontend

## 🚀 Getting Started

### 1. Development Environment Setup

#### Prerequisites
```bash
# Required software
node >= 18.0.0
pnpm >= 8.0.0  # Preferred package manager
git >= 2.30.0

# Recommended tools
VS Code with extensions:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Auto Import - ES6, TS, JSX, TSX
```

#### Project Setup
```bash
# Clone repository
git clone <repository-url>
cd workflow-engine

# Install dependencies (frontend)
cd web
pnpm install

# Environment configuration
cp .env.example .env.local
# Edit .env.local with your settings

# Start development server
pnpm run local  # NOT npm run dev - project has special setup
```

#### Environment Variables
```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
VITE_ENABLE_CONSOLE_LOG=true
VITE_NODE_PALETTE_MODE=unified

# Optional: Development features
VITE_DEBUG_MODE=true
VITE_MOCK_API=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
```

### 2. Project Structure Understanding

#### Source Code Organization
```
src/
├── components/                 # React components
│   ├── workflow-designer/     # Main workflow designer
│   │   ├── components/       # Designer sub-components
│   │   ├── contexts/         # Context providers
│   │   ├── hooks/           # Custom hooks
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   ├── shared/              # Shared/reusable components
│   └── ui/                  # Base UI components
├── hooks/                    # Global custom hooks
├── services/                # API and external services
├── types/                   # Global TypeScript definitions
├── utils/                   # Global utility functions
└── styles/                  # Global styles and themes
```

#### Key Configuration Files
```bash
# TypeScript configuration
tsconfig.json              # Main TypeScript config
tsconfig.node.json         # Node-specific config

# Build and development
vite.config.ts             # Vite build configuration
package.json               # Dependencies and scripts

# Code quality
eslint.config.js           # ESLint rules
.prettierrc                # Prettier formatting

# Styling
tailwind.config.js         # Tailwind CSS configuration
```

## 🛠️ Development Workflows

### 1. Feature Development Process

#### Creating New Components
```bash
# Create component directory
mkdir src/components/workflow-designer/components/NewComponent

# Component structure
touch NewComponent.tsx
touch NewComponent.test.tsx  
touch index.ts

# Types (if complex)
touch types.ts
```

#### Component Template
```typescript
// NewComponent.tsx
import React, { memo, useCallback } from 'react'
import { cn } from '@/utils/cn'

interface NewComponentProps {
  /**
   * Component description
   */
  children?: React.ReactNode
  className?: string
  
  // Event handlers
  onClick?: () => void
  
  // Required props
  id: string
  title: string
}

/**
 * NewComponent - Brief description of what this component does
 * 
 * @example
 * ```tsx
 * <NewComponent id="example" title="Example">
 *   Content here
 * </NewComponent>
 * ```
 */
export const NewComponent = memo<NewComponentProps>(({
  children,
  className,
  onClick,
  id,
  title
}) => {
  // Event handlers
  const handleClick = useCallback(() => {
    onClick?.()
  }, [onClick])
  
  return (
    <div 
      id={id}
      className={cn(
        // Base styles
        'relative flex items-center justify-center',
        'bg-white/10 backdrop-blur-sm',
        'border border-white/20 rounded-lg',
        'transition-all duration-200',
        
        // Interactive styles
        'hover:bg-white/20 hover:border-white/30',
        'focus:outline-none focus:ring-2 focus:ring-primary-500',
        
        // Custom styles
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={title}
    >
      {children}
    </div>
  )
})

NewComponent.displayName = 'NewComponent'

export default NewComponent
```

#### Testing Template
```typescript
// NewComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewComponent from './NewComponent'

describe('NewComponent', () => {
  it('renders with required props', () => {
    render(
      <NewComponent id="test" title="Test Component" />
    )
    
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByLabelText('Test Component')).toBeInTheDocument()
  })
  
  it('handles click events', () => {
    const handleClick = vi.fn()
    
    render(
      <NewComponent 
        id="test" 
        title="Test Component" 
        onClick={handleClick}
      />
    )
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
  
  it('applies custom className', () => {
    render(
      <NewComponent 
        id="test" 
        title="Test Component" 
        className="custom-class"
      />
    )
    
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })
})
```

### 2. Working with Context System

#### Using WorkflowContext
```typescript
// Custom hook for workflow operations
import { useWorkflowContext } from '../contexts/WorkflowContext'

export const useNodeOperations = () => {
  const { 
    state, 
    addNode, 
    updateNode, 
    deleteNode, 
    selectNode 
  } = useWorkflowContext()
  
  const createNode = useCallback((type: string, position: Position) => {
    const newNode: WorkflowNode = {
      id: generateId(),
      type,
      name: getDefaultNodeName(type),
      position,
      config: getDefaultNodeConfig(type),
      inputs: getNodeInputs(type),
      outputs: getNodeOutputs(type)
    }
    
    addNode(newNode)
    selectNode(newNode.id)
    
    return newNode
  }, [addNode, selectNode])
  
  const duplicateNode = useCallback((sourceNodeId: string) => {
    const sourceNode = state.nodes.find(node => node.id === sourceNodeId)
    if (!sourceNode) return null
    
    const duplicatedNode: WorkflowNode = {
      ...sourceNode,
      id: generateId(),
      name: `${sourceNode.name} (Copy)`,
      position: {
        x: sourceNode.position.x + 50,
        y: sourceNode.position.y + 50
      }
    }
    
    addNode(duplicatedNode)
    return duplicatedNode
  }, [state.nodes, addNode])
  
  return {
    createNode,
    duplicateNode,
    updateNode,
    deleteNode,
    selectNode
  }
}
```

#### Preventing Stale Closures in D3
```typescript
// useWorkflowCanvas.ts
export const useWorkflowCanvas = () => {
  const context = useWorkflowContext()
  
  // Critical: Use ref to prevent stale closures
  const currentStateRef = useRef(context.state)
  currentStateRef.current = context.state
  
  // D3 event handlers with fresh state access
  const setupDragBehavior = useCallback(() => {
    const drag = d3.drag<SVGGElement, WorkflowNode>()
      .on('start', function(event, d) {
        // Get fresh state every time
        const currentState = currentStateRef.current
        
        if (!currentState.draggingState.isDragging) {
          context.startDragging(d.id, { x: event.x, y: event.y })
          d3.select(this).classed('dragging', true)
        }
      })
      .on('drag', function(event, d) {
        // Update position with fresh context methods
        context.updateNode(d.id, {
          position: { x: event.x, y: event.y }
        })
      })
      .on('end', function(event, d) {
        context.endDragging()
        d3.select(this).classed('dragging', false)
      })
    
    return drag
  }, [context])
  
  return { setupDragBehavior }
}
```

### 3. Canvas Development Patterns

#### Adding New Canvas Tools
```typescript
// Custom canvas tool hook
export const useCanvasTool = (toolType: string) => {
  const canvasRef = useRef<SVGSVGElement>(null)
  const { state, dispatch } = useWorkflowContext()
  
  const activateTool = useCallback(() => {
    if (!canvasRef.current) return
    
    switch (toolType) {
      case 'select':
        setupSelectionTool(canvasRef.current)
        break
      case 'pan':
        setupPanTool(canvasRef.current)
        break
      case 'zoom':
        setupZoomTool(canvasRef.current)
        break
    }
  }, [toolType])
  
  const setupSelectionTool = (svg: SVGSVGElement) => {
    const selection = d3.select(svg)
    
    // Selection rectangle
    let selectionRect: d3.Selection<SVGRectElement, unknown, null, undefined>
    
    const brushed = (event: any) => {
      const [[x0, y0], [x1, y1]] = event.selection
      
      // Find nodes within selection
      const selectedNodes = state.nodes.filter(node => {
        return node.position.x >= x0 && node.position.x <= x1 &&
               node.position.y >= y0 && node.position.y <= y1
      })
      
      // Update selection
      dispatch({
        type: 'SET_SELECTED_NODES',
        payload: selectedNodes.map(node => node.id)
      })
    }
    
    const brush = d3.brush().on('brush', brushed)
    selection.call(brush)
  }
  
  return { activateTool, canvasRef }
}
```

#### Performance Optimization Patterns
```typescript
// Virtualized node rendering for large workflows
export const useVirtualizedNodes = (nodes: WorkflowNode[], viewBox: ViewBox) => {
  const visibleNodes = useMemo(() => {
    return nodes.filter(node => {
      return isNodeVisible(node, viewBox)
    })
  }, [nodes, viewBox])
  
  const renderNodes = useCallback(() => {
    // Only render visible nodes + buffer
    const buffer = 100 // pixels
    const bufferedViewBox = {
      x: viewBox.x - buffer,
      y: viewBox.y - buffer,
      width: viewBox.width + buffer * 2,
      height: viewBox.height + buffer * 2
    }
    
    return nodes.filter(node => isNodeVisible(node, bufferedViewBox))
  }, [nodes, viewBox])
  
  return { visibleNodes: renderNodes() }
}

// Throttled canvas updates
export const useThrottledCanvasUpdate = (updateFn: () => void, delay = 16) => {
  const throttledUpdate = useMemo(
    () => throttle(updateFn, delay),
    [updateFn, delay]
  )
  
  return throttledUpdate
}
```

## 🧪 Testing Strategy

### 1. Unit Testing

#### Testing Components
```typescript
// Component testing utilities
export const renderWithWorkflowContext = (
  component: React.ReactElement,
  initialState?: Partial<WorkflowState>
) => {
  const mockState: WorkflowState = {
    nodes: [],
    connections: [],
    selectedNodeId: null,
    draggingState: { isDragging: false },
    mode: 'workflow',
    ...initialState
  }
  
  const mockDispatch = vi.fn()
  
  return render(
    <WorkflowContext.Provider value={{
      state: mockState,
      dispatch: mockDispatch,
      // ... other context methods
    }}>
      {component}
    </WorkflowContext.Provider>
  )
}

// Example component test
describe('NodePalette', () => {
  it('filters nodes by search term', () => {
    renderWithWorkflowContext(
      <NodePalette mode="workflow" />,
      { mode: 'workflow' }
    )
    
    const searchInput = screen.getByPlaceholderText('Search nodes...')
    fireEvent.change(searchInput, { target: { value: 'http' } })
    
    expect(screen.getByText('HTTP Request')).toBeInTheDocument()
    expect(screen.queryByText('Database')).not.toBeInTheDocument()
  })
})
```

#### Testing Hooks
```typescript
// Custom hook testing
import { renderHook, act } from '@testing-library/react'

describe('useWorkflowCanvas', () => {
  it('handles zoom operations', () => {
    const { result } = renderHook(() => useWorkflowCanvas())
    
    act(() => {
      result.current.zoomIn()
    })
    
    expect(result.current.currentZoom).toBeGreaterThan(1)
  })
  
  it('resets canvas position based on node count', () => {
    const { result } = renderHook(() => useWorkflowCanvas())
    
    // Single node - center position
    act(() => {
      result.current.resetCanvasPosition([singleNode])
    })
    
    expect(result.current.focusPoint).toEqual({ x: 0.5, y: 0.5 })
    
    // Multiple nodes - offset position  
    act(() => {
      result.current.resetCanvasPosition([node1, node2])
    })
    
    expect(result.current.focusPoint).toEqual({ x: 0.3, y: 0.4 })
  })
})
```

### 2. Integration Testing

#### Testing Drag & Drop
```typescript
describe('Workflow Designer Integration', () => {
  it('supports drag and drop from palette to canvas', async () => {
    renderWithWorkflowContext(<WorkflowDesigner />)
    
    const httpNode = screen.getByText('HTTP Request')
    const canvas = screen.getByTestId('workflow-canvas')
    
    // Simulate drag start
    fireEvent.dragStart(httpNode, {
      dataTransfer: {
        setData: vi.fn(),
        getData: vi.fn(() => 'http')
      }
    })
    
    // Simulate drop on canvas
    fireEvent.dragOver(canvas)
    fireEvent.drop(canvas, {
      clientX: 300,
      clientY: 200
    })
    
    await waitFor(() => {
      expect(screen.getByTestId('node-http')).toBeInTheDocument()
    })
  })
})
```

#### Testing Context State Changes
```typescript
describe('WorkflowContext Integration', () => {
  it('coordinates state between components', () => {
    const TestComponent = () => {
      const { state, addNode, selectNode } = useWorkflowContext()
      
      return (
        <div>
          <div data-testid="node-count">{state.nodes.length}</div>
          <div data-testid="selected">{state.selectedNodeId || 'none'}</div>
          <button onClick={() => {
            const node = createTestNode('test-node')
            addNode(node)
            selectNode(node.id)
          }}>
            Add Node
          </button>
        </div>
      )
    }
    
    renderWithWorkflowContext(<TestComponent />)
    
    fireEvent.click(screen.getByText('Add Node'))
    
    expect(screen.getByTestId('node-count')).toHaveTextContent('1')
    expect(screen.getByTestId('selected')).toHaveTextContent('test-node')
  })
})
```

### 3. E2E Testing Setup

#### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox', 
      use: { ...devices['Desktop Firefox'] }
    }
  ],
  
  webServer: {
    command: 'pnpm run local',
    port: 5173,
    reuseExistingServer: !process.env.CI
  }
})
```

#### E2E Test Examples
```typescript
// e2e/workflow-creation.spec.ts
import { test, expect } from '@playwright/test'

test('can create a simple workflow', async ({ page }) => {
  await page.goto('/')
  
  // Switch to workflow mode
  await page.click('[data-testid="mode-selector"]')
  await page.click('text=Workflow')
  
  // Add HTTP node
  await page.dragAndDrop(
    '[data-testid="node-palette"] text=HTTP Request',
    '[data-testid="workflow-canvas"]'
  )
  
  // Verify node was added
  await expect(page.locator('[data-testid="node-http"]')).toBeVisible()
  
  // Configure node
  await page.click('[data-testid="node-http"]')
  await page.fill('[data-testid="url-input"]', 'https://api.example.com')
  
  // Save workflow
  await page.click('[data-testid="save-button"]')
  await expect(page.locator('text=Workflow saved')).toBeVisible()
})
```

## 🚀 Build & Deployment

### 1. Build Configuration

#### Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types')
    }
  },
  
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          d3: ['d3'],
          ui: ['lucide-react']
        }
      }
    }
  },
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
})
```

#### Build Scripts
```json
{
  "scripts": {
    "local": "vite --mode development",
    "build": "tsc && vite build",
    "build:staging": "tsc && vite build --mode staging", 
    "build:production": "tsc && vite build --mode production",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "type-check": "tsc --noEmit"
  }
}
```

### 2. Code Quality Tools

#### ESLint Configuration
```javascript
// eslint.config.js
export default [
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      'eslint:recommended',
      '@typescript-eslint/recommended',
      'plugin:react-hooks/recommended'
    ],
    rules: {
      // React specific
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // General code quality
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn'
    }
  }
]
```

#### Prettier Configuration
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### 3. Performance Monitoring

#### Performance Metrics
```typescript
// utils/performance.ts
export const measurePerformance = (name: string, fn: () => void) => {
  if (!shouldEnableConsoleLog()) return fn()
  
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  
  console.log(`[Performance] ${name}: ${end - start}ms`)
  return result
}

// React performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return React.memo((props: P) => {
    const renderStart = useRef(performance.now())
    
    useEffect(() => {
      const renderTime = performance.now() - renderStart.current
      if (shouldEnableConsoleLog() && renderTime > 16) { // > 1 frame
        console.warn(`[Performance] ${componentName} slow render: ${renderTime}ms`)
      }
    })
    
    return <Component {...props} />
  })
}
```

#### Bundle Analysis
```bash
# Analyze bundle size
pnpm add -D vite-bundle-analyzer
pnpm build
pnpm dlx vite-bundle-analyzer dist

# Check for unused dependencies
pnpm add -D depcheck
pnpm dlx depcheck

# Performance auditing
pnpm add -D lighthouse
pnpm dlx lighthouse http://localhost:5173 --output=html
```

---

**Next**: [API Reference](./07-api-reference.md) - Complete API documentation สำหรับ components และ hooks
