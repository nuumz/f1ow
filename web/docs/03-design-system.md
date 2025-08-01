# Design System - f1ow Workflow Engine Frontend

## 🎨 Design Philosophy

f1ow ใช้ modern design system ที่เน้น **functionality**, **aesthetics**, และ **accessibility** โดยผสมผสาน Glassmorphism effects กับ clean, professional interface

## 🌟 Visual Design Principles

### 1. Glassmorphism Design Language

#### Core Glass Effects
```css
/* Primary glass effect */
.glass-primary {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
}

/* Secondary glass effect */
.glass-secondary {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

/* Elevated glass effect */
.glass-elevated {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

#### Glass Component Examples
```css
/* Header with architecture dropdown */
.workflow-header {
  @apply glass-primary;
  backdrop-filter: blur(20px);
  background: rgba(248, 250, 252, 0.8);
}

/* Canvas toolbar */
.canvas-toolbar {
  @apply glass-secondary;
  position: absolute;
  top: 16px;
  right: 16px;
}

/* Node palette */
.node-palette {
  @apply glass-elevated;
  backdrop-filter: blur(12px);
}
```

### 2. Color System

#### Mode-Specific Palettes

**Workflow Mode**
```css
:root[data-mode="workflow"] {
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  
  --accent-50: #f0fdfa;
  --accent-500: #14b8a6;
  --accent-600: #0d9488;
}
```

**Architecture Mode**
```css
:root[data-mode="architecture"] {
  --primary-50: #faf5ff;
  --primary-100: #f3e8ff;
  --primary-500: #8b5cf6;
  --primary-600: #7c3aed;
  --primary-700: #6d28d9;
  
  --accent-50: #ecfdf5;
  --accent-500: #10b981;
  --accent-600: #059669;
}
```

**Neutral Palette**
```css
:root {
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-600: #475569;
  --gray-700: #334155;
  --gray-800: #1e293b;
  --gray-900: #0f172a;
}
```

### 3. Typography System

#### Font Hierarchy
```css
/* Primary font family */
.font-primary {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Monospace for code */
.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}
```

#### Text Scales
```css
/* Heading scales */
.text-2xl { font-size: 1.5rem; line-height: 2rem; }    /* 24px */
.text-xl { font-size: 1.25rem; line-height: 1.75rem; } /* 20px */
.text-lg { font-size: 1.125rem; line-height: 1.75rem; } /* 18px */
.text-base { font-size: 1rem; line-height: 1.5rem; }    /* 16px */
.text-sm { font-size: 0.875rem; line-height: 1.25rem; } /* 14px */
.text-xs { font-size: 0.75rem; line-height: 1rem; }     /* 12px */

/* Font weights */
.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
```

### 4. Icon System

#### Lucide React Integration
```typescript
// Standard icon sizes
const iconSizes = {
  xs: 12,
  sm: 14,
  base: 16,  // Default size (improved from 12-14px)
  lg: 20,
  xl: 24,
  '2xl': 32
} as const

// Icon component with consistent sizing
interface IconProps {
  name: keyof typeof lucideIcons
  size?: keyof typeof iconSizes
  className?: string
}

const Icon: React.FC<IconProps> = ({ name, size = 'base', className }) => {
  const LucideIcon = lucideIcons[name]
  return (
    <LucideIcon 
      size={iconSizes[size]} 
      className={cn('text-current', className)} 
    />
  )
}
```

#### Icon Usage Guidelines
```tsx
// Canvas toolbar icons (16px for better visibility)
<Button variant="ghost" size="sm">
  <Icon name="ZoomIn" size="base" />
</Button>

// Node palette icons (20px for prominence)
<div className="node-icon">
  <Icon name="Globe" size="lg" />
</div>

// Menu items (14px for compactness)
<MenuItem>
  <Icon name="Settings" size="sm" />
  Settings
</MenuItem>
```

## 🧩 Component Design Patterns

### 1. Button System

#### Button Variants
```css
/* Primary button */
.btn-primary {
  @apply bg-primary-600 hover:bg-primary-700 text-white;
  @apply px-4 py-2 rounded-lg font-medium;
  @apply transition-colors duration-200;
  @apply focus:outline-none focus:ring-2 focus:ring-primary-500;
}

/* Ghost button (for toolbars) */
.btn-ghost {
  @apply bg-transparent hover:bg-white/10 text-gray-700;
  @apply px-3 py-2 rounded-md;
  @apply transition-colors duration-200;
}

/* Glass button */
.btn-glass {
  @apply glass-secondary hover:glass-primary;
  @apply text-gray-700 hover:text-gray-900;
  @apply px-4 py-2 rounded-lg;
}
```

### 2. Card System

#### Card Components
```css
/* Base card */
.card {
  @apply glass-primary;
  @apply p-6 space-y-4;
}

/* Elevated card */
.card-elevated {
  @apply glass-elevated;
  @apply p-6 space-y-4;
  @apply shadow-xl;
}

/* Interactive card */
.card-interactive {
  @apply card hover:glass-elevated;
  @apply cursor-pointer transition-all duration-300;
  @apply hover:scale-[1.02] hover:shadow-xl;
}
```

### 3. Form System

#### Input Components
```css
/* Text input */
.input {
  @apply w-full px-3 py-2 rounded-lg border;
  @apply border-gray-300 focus:border-primary-500;
  @apply bg-white/80 backdrop-blur-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-primary-500/20;
}

/* Glass input */
.input-glass {
  @apply glass-secondary;
  @apply px-3 py-2 rounded-lg border-white/20;
  @apply focus:border-white/40 focus:ring-white/20;
  @apply placeholder-gray-400;
}
```

## 📱 Responsive Design System

### 1. Breakpoint Strategy

#### Breakpoint Definitions
```css
/* Tailwind CSS breakpoints */
/* sm: 640px  - Small tablets */
/* md: 768px  - Tablets */
/* lg: 1024px - Small desktops */
/* xl: 1280px - Large desktops */
/* 2xl: 1536px - Extra large screens */
```

#### Mobile-First Approach
```css
/* Base styles (mobile) */
.workflow-designer {
  @apply flex flex-col h-screen;
}

/* Tablet adjustments */
@media (min-width: 768px) {
  .workflow-designer {
    @apply flex-row;
  }
  
  .sidebar {
    @apply w-80;
  }
}

/* Desktop enhancements */
@media (min-width: 1024px) {
  .sidebar {
    @apply w-96;
  }
  
  .canvas-toolbar {
    @apply scale-110;
  }
}
```

### 2. Layout Patterns

#### Sidebar Behavior
```css
/* Mobile: Overlay sidebar */
.sidebar-mobile {
  @apply fixed inset-y-0 left-0 z-50 w-80;
  @apply transform transition-transform duration-300;
  @apply -translate-x-full;
}

.sidebar-mobile.open {
  @apply translate-x-0;
}

/* Desktop: Fixed sidebar */
.sidebar-desktop {
  @apply relative w-80 flex-shrink-0;
}
```

#### Canvas Responsive Behavior
```css
/* Canvas adapts to available space */
.workflow-canvas {
  @apply flex-1 relative overflow-hidden;
}

/* Toolbar positioning */
.canvas-toolbar {
  @apply absolute top-4 right-4;
  @apply z-10;
}

@media (max-width: 768px) {
  .canvas-toolbar {
    @apply top-2 right-2 scale-90;
  }
}
```

## ♿ Accessibility Design

### 1. Color Accessibility

#### Contrast Requirements
```css
/* WCAG AA compliance (4.5:1 minimum) */
.text-contrast-aa {
  color: #374151; /* 4.54:1 on white */
}

/* WCAG AAA compliance (7:1 minimum) */
.text-contrast-aaa {
  color: #1f2937; /* 8.59:1 on white */
}
```

#### Color-blind Friendly Palette
```css
/* Distinguishable colors for color-blind users */
.status-success { @apply bg-green-100 text-green-800; }
.status-warning { @apply bg-amber-100 text-amber-800; }
.status-error { @apply bg-red-100 text-red-800; }
.status-info { @apply bg-blue-100 text-blue-800; }
```

### 2. Keyboard Navigation

#### Focus Management
```css
/* Visible focus indicators */
.focus-visible {
  @apply outline-none ring-2 ring-primary-500 ring-offset-2;
}

/* Focus within containers */
.focus-within-highlight:focus-within {
  @apply ring-2 ring-primary-500/20;
}
```

#### Tab Order
```typescript
// Proper tab index management
const WorkflowDesigner = () => {
  return (
    <div role="application" aria-label="Workflow Designer">
      <header tabIndex={0}>
        <nav role="navigation">
          {/* Header navigation */}
        </nav>
      </header>
      
      <main tabIndex={0}>
        <aside role="complementary" aria-label="Node Palette">
          {/* Sidebar content */}
        </aside>
        
        <section role="main" aria-label="Canvas Area">
          {/* Canvas content */}
        </section>
      </main>
    </div>
  )
}
```

### 3. ARIA Labels

#### Semantic Markup
```typescript
// Accessible component examples
<Button 
  aria-label="Zoom in to canvas"
  aria-describedby="zoom-help"
>
  <ZoomIn size={16} />
</Button>

<Select
  aria-label="Choose architecture pattern"
  aria-expanded={isOpen}
  aria-haspopup="listbox"
>
  {/* Options */}
</Select>

<Canvas
  role="img"
  aria-label={`Workflow diagram with ${nodes.length} nodes`}
  aria-describedby="canvas-description"
/>
```

## 🎬 Animation & Transitions

### 1. Micro-interactions

#### Hover Effects
```css
/* Subtle hover animations */
.hover-lift {
  @apply transition-transform duration-200;
  @apply hover:scale-105 hover:shadow-lg;
}

.hover-glow {
  @apply transition-shadow duration-300;
  @apply hover:shadow-xl hover:shadow-primary-500/25;
}
```

#### Loading States
```css
/* Skeleton loading */
.skeleton {
  @apply bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200;
  @apply bg-[length:200%_100%];
  @apply animate-[shimmer_1.5s_infinite];
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 2. Page Transitions

#### Route Animations
```css
/* Page enter/exit animations */
.page-transition-enter {
  @apply opacity-0 translate-y-4;
}

.page-transition-enter-active {
  @apply opacity-100 translate-y-0;
  @apply transition-all duration-300 ease-out;
}

.page-transition-exit {
  @apply opacity-100 translate-y-0;
}

.page-transition-exit-active {
  @apply opacity-0 translate-y-4;
  @apply transition-all duration-200 ease-in;
}
```

## 🎯 Design System Usage Guidelines

### 1. Component Composition

#### Building Complex Components
```typescript
// Example: Architecture dropdown composition
const ArchitectureDropdown = () => {
  return (
    <Dropdown className="glass-secondary">
      <DropdownTrigger asChild>
        <Button variant="ghost" size="sm">
          <Icon name="Layout" size="base" />
          <span className="ml-2">Architecture</span>
          <Icon name="ChevronDown" size="sm" />
        </Button>
      </DropdownTrigger>
      
      <DropdownContent className="glass-elevated">
        <DropdownItem>
          <Icon name="Layers" size="sm" />
          Microservices
        </DropdownItem>
        {/* More items */}
      </DropdownContent>
    </Dropdown>
  )
}
```

### 2. Theming Best Practices

#### CSS Custom Properties
```css
/* Theme-aware components */
.themed-component {
  background: var(--glass-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --glass-primary: rgba(0, 0, 0, 0.2);
    --text-primary: #f8fafc;
    --border-primary: rgba(255, 255, 255, 0.1);
  }
}
```

---

**Next**: [Workflow Features](./04-workflow-features.md) - Workflow automation capabilities
