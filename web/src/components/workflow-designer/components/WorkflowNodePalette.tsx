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
  start: ({ size = 16 }) => <Zap size={size} />,
  if: ({ size = 16 }) => <GitBranch size={size} />,
  loop: ({ size = 16 }) => <Repeat size={size} />,
  subworkflow: ({ size = 16 }) => <Package size={size} />,
  set: ({ size = 16 }) => <Code size={size} />,
  json: ({ size = 16 }) => <FileText size={size} />,
  transform: ({ size = 16 }) => <Map size={size} />,
  filter: ({ size = 16 }) => <Filter size={size} />,
  calculate: ({ size = 16 }) => <Calculator size={size} />,
  http: ({ size = 16 }) => <Globe size={size} />,
  email: ({ size = 16 }) => <Mail size={size} />,
  mysql: ({ size = 16 }) => <Database size={size} />,
  postgresql: ({ size = 16 }) => <Database size={size} />,
  aiagent: ({ size = 16 }) => <Bot size={size} />,
  openai: ({ size = 16 }) => <Brain size={size} />,
  schedule: ({ size = 16 }) => <Clock size={size} />,
  webhook: ({ size = 16 }) => <Globe size={size} />,
  auth: ({ size = 16 }) => <Key size={size} />,
  encrypt: ({ size = 16 }) => <Shield size={size} />,
  delay: ({ size = 16 }) => <Pause size={size} />,
  config: ({ size = 16 }) => <Settings size={size} />,
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
      title="Workflow Nodes"
      nodes={workflowNodes}
      onAddNode={onAddNode}
      categories={categories}
      enableSearch={true}
      enableCategoryFilter={true}
      mode="automation"
      className={`workflow-node-palette ${className}`}
    />
  )
}
