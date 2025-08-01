# Mode System Architecture

This document describes the new mode-specific styling and behavior system that follows SOLID design principles and provides dramatically different visual experiences for workflow canvas modes.

## 🏗️ Architecture Overview

The mode system is built using several design patterns working together:

### Design Patterns Used

1. **Strategy Pattern** - Mode-specific rendering strategies
2. **Factory Pattern** - Mode creation and configuration
3. **Observer Pattern** - Mode change notifications
4. **Template Method Pattern** - Consistent mode switching algorithm
5. **Dependency Inversion** - Interface-based dependencies

### SOLID Principles Applied

- **Single Responsibility**: Each class/module has one reason to change
- **Open/Closed**: Easy to add new modes without modifying existing code
- **Liskov Substitution**: All strategies implement the same interface
- **Interface Segregation**: Clients depend only on methods they use
- **Dependency Inversion**: High-level modules don't depend on low-level details

## 🎨 Visual Distinctions

The system provides dramatically different visual themes for each mode:

### Workflow Mode (Execution-Focused)
- **Colors**: Bright blues (#2563eb) with green accents (#059669)
- **Connections**: Solid lines with smooth arrow markers
- **Ports**: Circular with clean borders
- **Background**: Light gray (#fcfcfc) with subtle grid
- **Animation**: Smooth pulses for selected elements
- **Identity**: Modern, clean, execution-oriented

### Architecture Mode (Structure-Focused)
- **Colors**: Deep purples (#7c3aed) with red accents (#dc2626)
- **Connections**: Dashed lines with diamond markers
- **Ports**: Rectangular with dashed borders
- **Background**: Dark gradient (#0f172a to #1e293b)
- **Animation**: Sophisticated pulses with glow effects
- **Identity**: Dark, professional, architectural

### Debug Mode (Analysis-Focused)
- **Colors**: Bright green (#10b981) with red alerts (#ef4444)
- **Connections**: Complex dash patterns with square markers
- **Ports**: Square with technical labeling
- **Background**: High-contrast black (#111827) with grid overlay
- **Animation**: High-contrast glow effects
- **Identity**: Terminal-like, technical, analytical

## 📁 File Structure

```
modes/
├── index.ts                    # Main entry point
├── mode-definitions.ts         # Pre-built mode configurations
├── mode-factory.ts            # Factory pattern implementation
├── rendering-strategies.ts     # Strategy pattern implementation
└── README.md                  # This documentation

types/
└── mode-system.ts             # TypeScript interfaces

services/
└── mode-manager.ts            # Centralized mode management

hooks/
└── useModeSystem.ts           # React integration hooks

styles/
└── mode-system.css            # Comprehensive CSS system

components/
└── ModeAwareWorkflowCanvas.tsx # Enhanced canvas component
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { useModeSystem, WORKFLOW_MODE, ARCHITECTURE_MODE } from './modes'

function MyComponent() {
  const { currentMode, switchMode, canSwitchToMode } = useModeSystem()
  
  const handleModeSwitch = async () => {
    if (canSwitchToMode('architecture')) {
      await switchMode('architecture')
    }
  }
  
  return (
    <div>
      <p>Current mode: {currentMode?.name}</p>
      <button onClick={handleModeSwitch}>Switch to Architecture</button>
    </div>
  )
}
```

### Creating Custom Modes

```typescript
import { modeFactory, createCustomMode } from './modes'

// Create a custom mode based on workflow mode
const myCustomMode = modeFactory.cloneMode('workflow', {
  id: 'my-custom-mode',
  name: 'My Custom Mode',
  theme: {
    ...WORKFLOW_MODE.theme,
    customProperties: {
      ...WORKFLOW_MODE.theme.customProperties,
      '--mode-primary-color': '#ff6b6b',
      '--mode-secondary-color': '#4ecdc4'
    }
  }
})

// Register the custom mode
const modeManager = getModeManager()
modeManager.registerMode(myCustomMode)
```

### Using the Enhanced Canvas

```typescript
import ModeAwareWorkflowCanvas from './components/ModeAwareWorkflowCanvas'

function WorkflowDesigner() {
  return (
    <ModeAwareWorkflowCanvas
      // ... standard canvas props
      enableModeSystem={true}
      enableModeTransitions={true}
      showModeIndicator={true}
      showDebugInfo={process.env.NODE_ENV === 'development'}
      onModeChange={(modeId) => console.log('Mode changed to:', modeId)}
    />
  )
}
```

## 🎯 Key Features

### Dramatic Visual Distinctions
- **Color Schemes**: Completely different palettes for each mode
- **Connection Styles**: Solid vs dashed vs complex patterns
- **Port Shapes**: Circles vs rectangles vs squares
- **Backgrounds**: Light vs dark vs high-contrast
- **Animations**: Mode-specific pulse and glow effects

### SOLID Architecture
- **Extensible**: Add new modes without touching existing code
- **Maintainable**: Clear separation of concerns
- **Testable**: Interface-based design enables easy mocking
- **Scalable**: Performance-optimized with caching and lazy loading

### Rich Customization
- **CSS Custom Properties**: Dynamic theming support
- **Behavior Configuration**: Per-mode interaction rules
- **Transition Effects**: Smooth mode switching animations
- **Debug Tools**: Built-in debugging and performance monitoring

## 🔧 Configuration

### Mode System Configuration

```typescript
const modeManager = getModeManager({
  enableTransitions: true,
  transitionDuration: 400,
  enableValidation: true,
  enableCaching: true,
  maxCacheSize: 50,
  debugMode: false,
  defaultModeId: 'workflow'
})
```

### Hook Configuration

```typescript
const modeSystem = useModeSystem({
  enableTransitions: true,
  transitionDuration: 400,
  enableCaching: true,
  autoApplyTheme: true,
  debugMode: false,
  onModeChange: (mode) => console.log('Mode changed:', mode.name),
  onTransitionStart: (from, to) => console.log('Transitioning:', from?.id, '->', to.id),
  onTransitionEnd: (mode) => console.log('Transition complete:', mode.id)
})
```

## 🎨 CSS Custom Properties

Each mode defines CSS custom properties for dynamic theming:

```css
.canvas-container.workflow-mode {
  --mode-primary-color: #2563eb;
  --mode-secondary-color: #059669;
  --mode-background: #fcfcfc;
  --mode-text-color: #1e293b;
  --mode-border-color: #e2e8f0;
  /* ... more properties */
}

.canvas-container.architecture-mode {
  --mode-primary-color: #7c3aed;
  --mode-secondary-color: #dc2626;
  --mode-background: #0f172a;
  --mode-text-color: #f3f4f6;
  --mode-border-color: #374151;
  /* ... more properties */
}
```

## 🔍 Mode Behaviors

Each mode can define different interaction behaviors:

```typescript
interface ModeBehavior {
  allowNodeCreation: boolean
  allowNodeDeletion: boolean
  allowConnectionCreation: boolean
  allowConnectionDeletion: boolean
  enableDragAndDrop: boolean
  enableMultiSelection: boolean
  enableContextMenu: boolean
  enableKeyboardShortcuts: boolean
  autoLayout: boolean
  snapToGrid: boolean
  showPortLabels: boolean
  showConnectionLabels: boolean
  enablePortTypeValidation: boolean
  enableExecutionVisualization: boolean
}
```

## 🧪 Testing

The mode system is designed for testability:

```typescript
import { resetModeManager, modeFactory } from './modes'

describe('Mode System', () => {
  beforeEach(() => {
    resetModeManager() // Clean slate for each test
  })
  
  it('should switch modes correctly', async () => {
    const manager = getModeManager()
    await manager.switchMode('architecture')
    expect(manager.getCurrentMode()?.id).toBe('architecture')
  })
  
  it('should validate mode configurations', () => {
    expect(() => {
      modeFactory.createMode({ id: 'invalid id!' }) // Invalid ID
    }).toThrow()
  })
})
```

## 🚀 Performance

The system includes several performance optimizations:

- **Lazy Loading**: Rendering strategies loaded on demand
- **Caching**: LRU cache for mode definitions and strategies
- **Batched Updates**: Mode changes trigger single re-render
- **GPU Acceleration**: CSS transforms use GPU when available
- **Containment**: CSS containment for large canvases

## 🔮 Extensibility

Adding new modes is straightforward:

### 1. Define the Mode

```typescript
const PRESENTATION_MODE: ModeDefinition = {
  id: 'presentation',
  name: 'Presentation Mode',
  description: 'Clean mode for presentations',
  theme: {
    // ... theme configuration
  },
  behavior: {
    // ... behavior configuration
  },
  transition: {
    // ... transition configuration
  },
  category: 'custom',
  priority: 4
}
```

### 2. Create Rendering Strategy

```typescript
export class PresentationRenderingStrategy extends BaseRenderingStrategy {
  readonly modeId = 'presentation'
  
  renderConnections(connections, theme) {
    // Custom rendering logic
  }
  
  renderPorts(ports, theme) {
    // Custom rendering logic
  }
  
  applyCanvasTransformations(element, theme) {
    // Custom canvas effects
  }
}
```

### 3. Register Everything

```typescript
// Register mode
const modeManager = getModeManager()
modeManager.registerMode(PRESENTATION_MODE)

// Register strategy
RenderingStrategyFactory.registerStrategy('presentation', 
  () => new PresentationRenderingStrategy()
)
```

## 🐛 Debug Features

The system includes comprehensive debugging:

- **Debug Mode**: Detailed logging and performance monitoring
- **Visual Overlays**: Debug information overlaid on canvas
- **Event Tracking**: All mode system events logged
- **Performance Metrics**: Render time and memory usage tracking
- **Validation**: Runtime validation of mode configurations

## 🎯 Migration Guide

To migrate from the old system:

### 1. Import New System
```typescript
import ModeAwareWorkflowCanvas from './components/ModeAwareWorkflowCanvas'
import { useModeSystem } from './hooks/useModeSystem'
```

### 2. Replace Canvas Component
```typescript
// Old
<WorkflowCanvas {...props} />

// New
<ModeAwareWorkflowCanvas {...props} enableModeSystem={true} />
```

### 3. Update Mode Switching
```typescript
// Old
const [designerMode, setDesignerMode] = useState('workflow')

// New
const { currentMode, switchMode } = useModeSystem()
```

### 4. Include CSS
```typescript
import './styles/mode-system.css'
```

## 📈 Benefits

The new mode system provides:

1. **Dramatic Visual Distinctions**: Users can immediately identify the current mode
2. **SOLID Architecture**: Maintainable, extensible, and testable codebase
3. **Rich Customization**: Easy to create and customize modes
4. **Performance Optimized**: Efficient rendering and transitions
5. **Developer Experience**: Comprehensive debugging and validation tools
6. **Future-Proof**: Easy to add new modes and features

This architecture ensures that the mode differences are not just cosmetic changes, but provide fundamentally different visual and behavioral experiences that guide users in their workflow design process.