/**
 * Workflow Node Palette
 * Using the unified BaseNodePalette with workflow-specific configurations
 */

import { useMemo } from 'react'
import { 
  Globe, Code, Database, GitBranch, Package, Bot, Brain, Zap, 
  Mail, Clock, FileText, Pause, Settings, Repeat,
  Filter, Map, Calculator, Key, Shield
} from 'lucide-react'
import BaseNodePalette, { type NodePaletteItem } from './BaseNodePalette'

interface WorkflowNodePaletteProps {
  readonly onAddNode: (type: string, position?: { x: number; y: number }) => void
  readonly className?: string
}

// Icon components to avoid creating components inside render
const iconComponents = {
  start: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Zap size={size} {...props} />,
  if: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <GitBranch size={size} {...props} />,
  loop: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Repeat size={size} {...props} />,
  subworkflow: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Package size={size} {...props} />,
  set: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Code size={size} {...props} />,
  json: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <FileText size={size} {...props} />,
  transform: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Map size={size} {...props} />,
  filter: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Filter size={size} {...props} />,
  calculate: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Calculator size={size} {...props} />,
  http: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Globe size={size} {...props} />,
  email: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Mail size={size} {...props} />,
  mysql: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Database size={size} {...props} />,
  postgresql: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Database size={size} {...props} />,
  aiagent: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Bot size={size} {...props} />,
  openai: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Brain size={size} {...props} />,
  schedule: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Clock size={size} {...props} />,
  webhook: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Globe size={size} {...props} />,
  auth: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Key size={size} {...props} />,
  encrypt: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Shield size={size} {...props} />,
  delay: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Pause size={size} {...props} />,
  config: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Settings size={size} {...props} />,
} as const

export default function WorkflowNodePalette({ 
  onAddNode, 
  className = '' 
}: WorkflowNodePaletteProps) {
  
  const workflowNodes: NodePaletteItem[] = useMemo(() => [
    // Core Flow Control
    { 
      type: 'start', 
      label: 'Start', 
      icon: iconComponents.start, 
      category: 'Flow Control',
      description: 'Start point of workflow execution',
      color: '#10b981'
    },
    { 
      type: 'if', 
      label: 'Condition (IF)', 
      icon: iconComponents.if, 
      category: 'Flow Control',
      description: 'Conditional branching logic',
      color: '#f59e0b'
    },
    { 
      type: 'loop', 
      label: 'Loop', 
      icon: iconComponents.loop, 
      category: 'Flow Control',
      description: 'Repeat actions multiple times',
      color: '#8b5cf6'
    },
    { 
      type: 'subworkflow', 
      label: 'Sub-workflow', 
      icon: iconComponents.subworkflow, 
      category: 'Flow Control',
      description: 'Execute another workflow',
      color: '#06b6d4'
    },
    
    // Data Operations
    { 
      type: 'set', 
      label: 'Set Variable', 
      icon: iconComponents.set, 
      category: 'Data Operations',
      description: 'Set or modify variables',
      color: '#6366f1'
    },
    { 
      type: 'json', 
      label: 'JSON Transform', 
      icon: iconComponents.json, 
      category: 'Data Operations',
      description: 'Parse and manipulate JSON data',
      color: '#ec4899'
    },
    { 
      type: 'transform', 
      label: 'Data Transform', 
      icon: iconComponents.transform, 
      category: 'Data Operations',
      description: 'Transform data between formats',
      color: '#84cc16'
    },
    { 
      type: 'filter', 
      label: 'Filter Data', 
      icon: iconComponents.filter, 
      category: 'Data Operations',
      description: 'Filter arrays and objects',
      color: '#f97316'
    },
    { 
      type: 'calculate', 
      label: 'Calculate', 
      icon: iconComponents.calculate, 
      category: 'Data Operations',
      description: 'Perform mathematical operations',
      color: '#0ea5e9'
    },
    
    // External Services
    { 
      type: 'http', 
      label: 'HTTP Request', 
      icon: iconComponents.http, 
      category: 'External Services',
      description: 'Make HTTP API calls',
      color: '#3b82f6'
    },
    { 
      type: 'email', 
      label: 'Send Email', 
      icon: iconComponents.email, 
      category: 'External Services',
      description: 'Send email notifications',
      color: '#ef4444'
    },
    
    // Database
    { 
      type: 'mysql', 
      label: 'MySQL Query', 
      icon: iconComponents.mysql, 
      category: 'Database',
      description: 'Execute MySQL database queries',
      color: '#f59e0b'
    },
    { 
      type: 'postgresql', 
      label: 'PostgreSQL Query', 
      icon: iconComponents.postgresql, 
      category: 'Database',
      description: 'Execute PostgreSQL database queries',
      color: '#3b82f6'
    },
    
    // AI & Machine Learning
    { 
      type: 'aiagent', 
      label: 'AI Agent', 
      icon: iconComponents.aiagent, 
      category: 'AI & ML',
      description: 'Intelligent AI-powered automation',
      color: '#8b5cf6'
    },
    { 
      type: 'openai', 
      label: 'OpenAI', 
      icon: iconComponents.openai, 
      category: 'AI & ML',
      description: 'OpenAI GPT integration',
      color: '#10b981'
    },
    
    // Scheduling & Triggers
    { 
      type: 'schedule', 
      label: 'Schedule', 
      icon: iconComponents.schedule, 
      category: 'Scheduling',
      description: 'Time-based triggers',
      color: '#64748b'
    },
    { 
      type: 'webhook', 
      label: 'Webhook', 
      icon: iconComponents.webhook, 
      category: 'Scheduling',
      description: 'HTTP webhook triggers',
      color: '#06b6d4'
    },
    
    // Security & Authentication
    { 
      type: 'auth', 
      label: 'Authentication', 
      icon: iconComponents.auth, 
      category: 'Security',
      description: 'User authentication and authorization',
      color: '#dc2626'
    },
    { 
      type: 'encrypt', 
      label: 'Encrypt Data', 
      icon: iconComponents.encrypt, 
      category: 'Security',
      description: 'Encrypt sensitive data',
      color: '#7c3aed'
    },
    
    // System Operations
    { 
      type: 'delay', 
      label: 'Delay', 
      icon: iconComponents.delay, 
      category: 'System',
      description: 'Add delays between operations',
      color: '#6b7280'
    },
    { 
      type: 'config', 
      label: 'Configuration', 
      icon: iconComponents.config, 
      category: 'System',
      description: 'Manage workflow configuration',
      color: '#4b5563'
    }
  ], [])

  const categories = useMemo(() => [
    'Flow Control',
    'Data Operations', 
    'External Services',
    'Database',
    'AI & ML',
    'Scheduling',
    'Security',
    'System'
  ], [])

  return (
    <BaseNodePalette
      nodes={workflowNodes}
      onAddNode={onAddNode}
      categories={categories}
      enableSearch={true}
      enableCategoryFilter={true}
      className={`workflow-node-palette ${className}`}
    />
  )
}
