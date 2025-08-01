/**
 * Dramatic Mode Definitions
 * Each mode has a completely distinct visual identity following SOLID principles
 */

import type { ModeDefinition } from '../types/mode-system'

/**
 * WORKFLOW MODE - Execution-Focused, Bright & Clean
 * Identity: Modern execution environment with bright blues and clean lines
 */
export const WORKFLOW_MODE: ModeDefinition = {
  id: 'workflow',
  name: 'Workflow Execution',
  description: 'Optimized for workflow execution and data flow visualization',
  category: 'execution',
  
  theme: {
    primary: '#2563eb',       // Bright blue
    secondary: '#3b82f6',     // Medium blue  
    accent: '#1d4ed8',        // Dark blue
    background: '#f8fafc',    // Light gray-blue
    foreground: '#1e293b',    // Dark slate
    success: '#10b981',       // Emerald green
    warning: '#f59e0b',       // Amber
    error: '#ef4444',         // Red
    gradients: {
      primary: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      secondary: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    },
    shadows: {
      small: '0 2px 4px rgba(37, 99, 235, 0.1)',
      medium: '0 4px 12px rgba(37, 99, 235, 0.15)',
      large: '0 8px 32px rgba(37, 99, 235, 0.2)',
      connection: '0 2px 8px rgba(37, 99, 235, 0.25)',
      port: '0 2px 6px rgba(37, 99, 235, 0.2)'
    }
  },
  
  connectionStyle: {
    strokeWidth: 2.5,
    strokeDashArray: undefined, // Solid lines
    opacity: 0.9,
    animationType: 'flow',
    markerType: 'arrow',
    markerSize: 12,
    hoverEffect: {
      strokeWidth: 3.5,
      opacity: 1.0,
      shadowBlur: 8,
      scaleTransform: 1.05
    },
    selectionEffect: {
      strokeWidth: 4,
      opacity: 1.0,
      shadowBlur: 12,
      glowColor: '#10b981',
      animationDuration: 1500
    },
    transitionDuration: 200
  },
  
  portStyle: {
    shape: 'circle',
    size: 8,
    strokeWidth: 2,
    shadowBlur: 4,
    connectedIndicator: {
      enabled: true,
      style: 'glow',
      intensity: 0.8
    },
    typeIndicators: {
      enabled: true,
      style: 'color',
      colorMapping: {
        string: '#10b981',   // Green
        number: '#2563eb',   // Blue
        boolean: '#f59e0b',  // Amber
        object: '#8b5cf6',   // Purple
        array: '#06b6d4',    // Cyan
        any: '#6b7280'       // Gray
      }
    },
    hoverEffect: {
      scaleTransform: 1.3,
      shadowBlur: 8,
      transitionDuration: 150
    },
    labelStyle: {
      enabled: true,
      fontSize: 11,
      fontWeight: 'normal',
      position: 'tooltip'
    }
  },
  
  canvasStyle: {
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    gridStyle: {
      enabled: true,
      type: 'dots',
      size: 20,
      color: '#cbd5e1',
      opacity: 0.4,
      style: 'solid'
    },
    overlayEffects: [],
    nodeStyle: {
      borderRadius: 8,
      shadowIntensity: 0.15,
      glowEffect: false,
      backgroundOpacity: 0.95
    },
    animations: {
      backgroundAnimation: false,
      gridAnimation: false,
      transitionDuration: 300,
      easingFunction: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
    }
  },
  
  interactions: {
    doubleClickAction: 'edit',
    dragBehavior: {
      snapToGrid: true,
      ghostEffect: true,
      collisionDetection: true,
      magneticPorts: true
    },
    connectionBehavior: {
      autoRouting: true,
      smartConnections: true,
      previewStyle: 'dashed',
      validationFeedback: true
    },
    selectionBehavior: {
      multiSelect: true,
      rectangularSelection: true,
      selectionIndicator: 'glow'
    },
    keyboardShortcuts: [
      { key: 'Enter', modifiers: [], action: 'execute', description: 'Execute workflow' },
      { key: 'Space', modifiers: [], action: 'pause', description: 'Pause execution' }
    ]
  },
  
  metadata: {
    version: '1.0.0',
    author: 'f1ow Team',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    tags: ['execution', 'workflow', 'dataflow'],
    documentation: 'Optimized for workflow execution with clear visual feedback',
    examples: [
      {
        title: 'Data Processing Pipeline',
        description: 'ETL workflow with clear data flow visualization'
      }
    ]
  }
}

/**
 * ARCHITECTURE MODE - Structure-Focused, Dark & Sophisticated  
 * Identity: Architectural blueprints with dark background and purple accents
 */
export const ARCHITECTURE_MODE: ModeDefinition = {
  id: 'architecture',
  name: 'System Architecture',
  description: 'Focused on system design and architectural visualization',
  category: 'design',
  
  theme: {
    primary: '#8b5cf6',       // Purple
    secondary: '#a78bfa',     // Light purple
    accent: '#7c3aed',        // Dark purple
    background: '#1e1b2e',    // Dark purple-gray
    foreground: '#e2d6ff',    // Light purple
    success: '#34d399',       // Emerald
    warning: '#fbbf24',       // Yellow
    error: '#f87171',         // Light red
    gradients: {
      primary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      secondary: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
      background: 'linear-gradient(135deg, #1e1b2e 0%, #2d1b57 100%)'
    },
    shadows: {
      small: '0 2px 8px rgba(139, 92, 246, 0.2)',
      medium: '0 4px 16px rgba(139, 92, 246, 0.25)',
      large: '0 8px 40px rgba(139, 92, 246, 0.3)',
      connection: '0 3px 12px rgba(139, 92, 246, 0.4)',
      port: '0 3px 10px rgba(139, 92, 246, 0.35)'
    }
  },
  
  connectionStyle: {
    strokeWidth: 3,
    strokeDashArray: '12,6',  // Architectural dashed lines
    opacity: 0.85,
    animationType: 'pulse',
    markerType: 'diamond',
    markerSize: 14,
    hoverEffect: {
      strokeWidth: 4.5,
      opacity: 1.0,
      shadowBlur: 16,
      scaleTransform: 1.1
    },
    selectionEffect: {
      strokeWidth: 5,
      opacity: 1.0,
      shadowBlur: 20,
      glowColor: '#f87171',
      animationDuration: 2000
    },
    transitionDuration: 300
  },
  
  portStyle: {
    shape: 'square',
    size: 10,
    strokeWidth: 2.5,
    shadowBlur: 6,
    connectedIndicator: {
      enabled: true,
      style: 'pulse',
      intensity: 1.0
    },
    typeIndicators: {
      enabled: true,
      style: 'pattern',
      colorMapping: {
        service: '#8b5cf6',    // Purple
        database: '#06b6d4',   // Cyan
        api: '#10b981',        // Green
        queue: '#f59e0b',      // Amber
        cache: '#ef4444',      // Red
        external: '#6b7280'    // Gray
      }
    },
    hoverEffect: {
      scaleTransform: 1.4,
      shadowBlur: 12,
      transitionDuration: 200
    },
    labelStyle: {
      enabled: true,
      fontSize: 12,
      fontWeight: 'bold',
      position: 'outside'
    }
  },
  
  canvasStyle: {
    backgroundType: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #1e1b2e 0%, #2d1b57 100%)',
    gridStyle: {
      enabled: true,
      type: 'lines',
      size: 24,
      color: '#4c1d95',
      opacity: 0.3,
      style: 'dashed'
    },
    overlayEffects: [
      {
        type: 'vignette',
        intensity: 0.6,
        color: '#1e1b2e',
        animation: 'static'
      }
    ],
    nodeStyle: {
      borderRadius: 4,
      shadowIntensity: 0.3,
      glowEffect: true,
      backgroundOpacity: 0.9
    },
    animations: {
      backgroundAnimation: true,
      gridAnimation: true,
      transitionDuration: 500,
      easingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }
  },
  
  interactions: {
    doubleClickAction: 'properties',
    dragBehavior: {
      snapToGrid: true,
      ghostEffect: true,
      collisionDetection: false,
      magneticPorts: false
    },
    connectionBehavior: {
      autoRouting: false,
      smartConnections: false,
      previewStyle: 'dotted',
      validationFeedback: false
    },
    selectionBehavior: {
      multiSelect: true,
      rectangularSelection: true,
      selectionIndicator: 'highlight'
    },
    keyboardShortcuts: [
      { key: 'A', modifiers: ['ctrl'], action: 'align', description: 'Align components' },
      { key: 'G', modifiers: ['ctrl'], action: 'group', description: 'Group selection' }
    ]
  },
  
  metadata: {
    version: '1.0.0',
    author: 'f1ow Team',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    tags: ['architecture', 'design', 'system'],
    documentation: 'Specialized for system architecture and design documentation',
    examples: [
      {
        title: 'Microservices Architecture',
        description: 'Complex system with multiple services and databases'
      }
    ]
  }
}

/**
 * DEBUG MODE - Analysis-Focused, High Contrast Technical
 * Identity: Terminal-like with high contrast colors for technical analysis
 */
export const DEBUG_MODE: ModeDefinition = {
  id: 'debug',
  name: 'Debug Analysis',
  description: 'Technical analysis mode with detailed diagnostic information',
  category: 'analysis',
  
  theme: {
    primary: '#00ff88',       // Bright green
    secondary: '#00cc66',     // Medium green
    accent: '#ff4444',        // Bright red
    background: '#0d1117',    // Dark gray (GitHub dark)
    foreground: '#ffffff',    // Pure white
    success: '#00ff88',       // Bright green
    warning: '#ffaa00',       // Orange
    error: '#ff4444',         // Bright red
    gradients: {
      primary: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
      secondary: 'linear-gradient(135deg, #ff4444 0%, #cc3333 100%)',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)'
    },
    shadows: {
      small: '0 2px 4px rgba(0, 255, 136, 0.3)',
      medium: '0 4px 12px rgba(0, 255, 136, 0.4)',
      large: '0 8px 32px rgba(0, 255, 136, 0.5)',
      connection: '0 3px 10px rgba(0, 255, 136, 0.6)',
      port: '0 2px 8px rgba(0, 255, 136, 0.5)'
    }
  },
  
  connectionStyle: {
    strokeWidth: 2,
    strokeDashArray: '6,3,2,3', // Complex technical pattern
    opacity: 0.95,
    animationType: 'wave',
    markerType: 'square',
    markerSize: 8,
    hoverEffect: {
      strokeWidth: 4,
      opacity: 1.0,
      shadowBlur: 20,
      scaleTransform: 1.2
    },
    selectionEffect: {
      strokeWidth: 5,
      opacity: 1.0,
      shadowBlur: 25,
      glowColor: '#ff4444',
      animationDuration: 1000
    },
    transitionDuration: 100
  },
  
  portStyle: {
    shape: 'hexagon',
    size: 12,
    strokeWidth: 3,
    shadowBlur: 8,
    connectedIndicator: {
      enabled: true,
      style: 'border',
      intensity: 1.2
    },
    typeIndicators: {
      enabled: true,
      style: 'icon',
      colorMapping: {
        data: '#00ff88',      // Green
        error: '#ff4444',     // Red
        warning: '#ffaa00',   // Orange
        info: '#00aaff',      // Blue
        debug: '#aa00ff',     // Purple
        trace: '#ffffff'      // White
      }
    },
    hoverEffect: {
      scaleTransform: 1.5,
      shadowBlur: 15,
      transitionDuration: 100
    },
    labelStyle: {
      enabled: true,
      fontSize: 10,
      fontWeight: 'normal',
      position: 'inside'
    }
  },
  
  canvasStyle: {
    backgroundType: 'solid',
    backgroundValue: '#0d1117',
    gridStyle: {
      enabled: true,
      type: 'cross',
      size: 16,
      color: '#30363d',
      opacity: 0.8,
      style: 'dotted'
    },
    overlayEffects: [
      {
        type: 'scanlines',
        intensity: 0.1,
        color: '#00ff88',
        animation: 'slow'
      },
      {
        type: 'noise',
        intensity: 0.05,
        color: '#ffffff',
        animation: 'fast'
      }
    ],
    nodeStyle: {
      borderRadius: 2,
      shadowIntensity: 0.5,
      glowEffect: true,
      backgroundOpacity: 0.85
    },
    animations: {
      backgroundAnimation: true,
      gridAnimation: true,
      transitionDuration: 150,
      easingFunction: 'linear'
    }
  },
  
  interactions: {
    doubleClickAction: 'expand',
    dragBehavior: {
      snapToGrid: false,
      ghostEffect: false,
      collisionDetection: true,
      magneticPorts: false
    },
    connectionBehavior: {
      autoRouting: false,
      smartConnections: false,
      previewStyle: 'solid',
      validationFeedback: true
    },
    selectionBehavior: {
      multiSelect: true,
      rectangularSelection: false,
      selectionIndicator: 'border'
    },
    keyboardShortcuts: [
      { key: 'D', modifiers: ['ctrl'], action: 'debug', description: 'Toggle debug info' },
      { key: 'L', modifiers: ['ctrl'], action: 'logs', description: 'Show logs' }
    ]
  },
  
  metadata: {
    version: '1.0.0',
    author: 'f1ow Team',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    tags: ['debug', 'analysis', 'technical'],
    documentation: 'High-contrast mode for technical analysis and debugging',
    examples: [
      {
        title: 'Error Flow Analysis',
        description: 'Trace error propagation through system components'
      }
    ]
  }
}

// Export all modes
export const AVAILABLE_MODES = {
  workflow: WORKFLOW_MODE,
  architecture: ARCHITECTURE_MODE,
  debug: DEBUG_MODE
} as const

export type ModeId = keyof typeof AVAILABLE_MODES