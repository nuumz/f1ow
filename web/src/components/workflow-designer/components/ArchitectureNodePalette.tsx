/**
 * Architecture Node Palette
 * Using the unified BaseNodePalette with architecture-specific configurations
 */

import { useMemo } from 'react'
import { 
  Server, Database, Globe, Shield, Monitor, Cloud, 
  GitBranch, Package, Users, FileText, Box, Layers,
  Cpu, HardDrive, Network, Lock, Smartphone, Tablet
} from 'lucide-react'
import BaseNodePalette, { type NodePaletteItem } from './BaseNodePalette'

interface ArchitectureNodePaletteProps {
  readonly onAddNode: (type: string, position?: { x: number; y: number }) => void
  readonly className?: string
}

// Icon components to avoid creating components inside render
const iconComponents = {
  // Infrastructure
  server: ({ size = 16 }) => <Server size={size} />,
  database: ({ size = 16 }) => <Database size={size} />,
  loadbalancer: ({ size = 16 }) => <Network size={size} />,
  cdn: ({ size = 16 }) => <Globe size={size} />,
  cache: ({ size = 16 }) => <HardDrive size={size} />,
  
  // Services
  microservice: ({ size = 16 }) => <Box size={size} />,
  api: ({ size = 16 }) => <Globe size={size} />,
  queue: ({ size = 16 }) => <Package size={size} />,
  storage: ({ size = 16 }) => <Database size={size} />,
  
  // Cloud Services
  cloudfunction: ({ size = 16 }) => <Cloud size={size} />,
  container: ({ size = 16 }) => <Box size={size} />,
  kubernetes: ({ size = 16 }) => <Layers size={size} />,
  
  // Security
  firewall: ({ size = 16 }) => <Shield size={size} />,
  auth: ({ size = 16 }) => <Lock size={size} />,
  
  // External Systems
  external: ({ size = 16 }) => <Globe size={size} />,
  thirdparty: ({ size = 16 }) => <Package size={size} />,
  
  // Client Applications
  webapp: ({ size = 16 }) => <Monitor size={size} />,
  mobile: ({ size = 16 }) => <Smartphone size={size} />,
  tablet: ({ size = 16 }) => <Tablet size={size} />,
  
  // Data Flow
  processor: ({ size = 16 }) => <Cpu size={size} />,
  pipeline: ({ size = 16 }) => <GitBranch size={size} />,
  
  // Documentation
  documentation: ({ size = 16 }) => <FileText size={size} />,
  team: ({ size = 16 }) => <Users size={size} />,
} as const

export default function ArchitectureNodePalette({ 
  onAddNode, 
  className = '' 
}: ArchitectureNodePaletteProps) {
  
  const architectureNodes: NodePaletteItem[] = useMemo(() => [
    // Infrastructure Components
    { 
      type: 'server', 
      label: 'Application Server', 
      icon: iconComponents.server, 
      category: 'Infrastructure',
      description: 'Application hosting server',
      color: '#3b82f6'
    },
    { 
      type: 'database', 
      label: 'Database', 
      icon: iconComponents.database, 
      category: 'Infrastructure',
      description: 'Data storage and management',
      color: '#f59e0b'
    },
    { 
      type: 'loadbalancer', 
      label: 'Load Balancer', 
      icon: iconComponents.loadbalancer, 
      category: 'Infrastructure',
      description: 'Traffic distribution and balancing',
      color: '#10b981'
    },
    { 
      type: 'cdn', 
      label: 'CDN', 
      icon: iconComponents.cdn, 
      category: 'Infrastructure',
      description: 'Content delivery network',
      color: '#06b6d4'
    },
    { 
      type: 'cache', 
      label: 'Cache Layer', 
      icon: iconComponents.cache, 
      category: 'Infrastructure',
      description: 'In-memory caching system',
      color: '#8b5cf6'
    },
    
    // Microservices & APIs
    { 
      type: 'microservice', 
      label: 'Microservice', 
      icon: iconComponents.microservice, 
      category: 'Services',
      description: 'Independent service component',
      color: '#ec4899'
    },
    { 
      type: 'api', 
      label: 'REST API', 
      icon: iconComponents.api, 
      category: 'Services',
      description: 'RESTful API endpoint',
      color: '#84cc16'
    },
    { 
      type: 'queue', 
      label: 'Message Queue', 
      icon: iconComponents.queue, 
      category: 'Services',
      description: 'Asynchronous message processing',
      color: '#f97316'
    },
    { 
      type: 'storage', 
      label: 'Object Storage', 
      icon: iconComponents.storage, 
      category: 'Services',
      description: 'File and object storage service',
      color: '#0ea5e9'
    },
    
    // Cloud & Containers
    { 
      type: 'cloudfunction', 
      label: 'Cloud Function', 
      icon: iconComponents.cloudfunction, 
      category: 'Cloud',
      description: 'Serverless function execution',
      color: '#6366f1'
    },
    { 
      type: 'container', 
      label: 'Container', 
      icon: iconComponents.container, 
      category: 'Cloud',
      description: 'Containerized application',
      color: '#64748b'
    },
    { 
      type: 'kubernetes', 
      label: 'Kubernetes Cluster', 
      icon: iconComponents.kubernetes, 
      category: 'Cloud',
      description: 'Container orchestration platform',
      color: '#7c3aed'
    },
    
    // Security Components
    { 
      type: 'firewall', 
      label: 'Firewall', 
      icon: iconComponents.firewall, 
      category: 'Security',
      description: 'Network security and filtering',
      color: '#dc2626'
    },
    { 
      type: 'auth', 
      label: 'Auth Service', 
      icon: iconComponents.auth, 
      category: 'Security',
      description: 'Authentication and authorization',
      color: '#991b1b'
    },
    
    // External Systems
    { 
      type: 'external', 
      label: 'External System', 
      icon: iconComponents.external, 
      category: 'External',
      description: 'Third-party or external service',
      color: '#4b5563'
    },
    { 
      type: 'thirdparty', 
      label: 'Third-party API', 
      icon: iconComponents.thirdparty, 
      category: 'External',
      description: 'External API integration',
      color: '#6b7280'
    },
    
    // Client Applications
    { 
      type: 'webapp', 
      label: 'Web Application', 
      icon: iconComponents.webapp, 
      category: 'Clients',
      description: 'Browser-based application',
      color: '#059669'
    },
    { 
      type: 'mobile', 
      label: 'Mobile App', 
      icon: iconComponents.mobile, 
      category: 'Clients',
      description: 'Mobile application client',
      color: '#0891b2'
    },
    { 
      type: 'tablet', 
      label: 'Tablet App', 
      icon: iconComponents.tablet, 
      category: 'Clients',
      description: 'Tablet application interface',
      color: '#0284c7'
    },
    
    // Data Processing
    { 
      type: 'processor', 
      label: 'Data Processor', 
      icon: iconComponents.processor, 
      category: 'Data Flow',
      description: 'Data processing and transformation',
      color: '#be185d'
    },
    { 
      type: 'pipeline', 
      label: 'Data Pipeline', 
      icon: iconComponents.pipeline, 
      category: 'Data Flow',
      description: 'Data processing pipeline',
      color: '#c2410c'
    },
    
    // Documentation & Team
    { 
      type: 'documentation', 
      label: 'Documentation', 
      icon: iconComponents.documentation, 
      category: 'Documentation',
      description: 'System documentation and guides',
      color: '#374151'
    },
    { 
      type: 'team', 
      label: 'Development Team', 
      icon: iconComponents.team, 
      category: 'Documentation',
      description: 'Team or stakeholder group',
      color: '#1f2937'
    }
  ], [])

  const categories = useMemo(() => [
    'Infrastructure',
    'Services', 
    'Cloud',
    'Security',
    'External',
    'Clients',
    'Data Flow',
    'Documentation'
  ], [])

  return (
    <BaseNodePalette
      title="Architecture Components"
      nodes={architectureNodes}
      onAddNode={onAddNode}
      categories={categories}
      enableSearch={true}
      enableCategoryFilter={true}
      mode="diagram"
      className={`architecture-node-palette ${className}`}
    />
  )
}
