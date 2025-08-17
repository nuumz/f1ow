/**
 * Architecture Node Palette
 * Using the unified BaseNodePalette with architecture-specific configurations
 */

import { useMemo } from 'react'
import { 
  Server, Database, Globe, Shield, Monitor, Cloud, 
  GitBranch, Package, Users, FileText, Layers,
  Cpu, HardDrive, Lock, Smartphone, Tablet, Network
} from 'lucide-react'
import BaseNodePalette, { type NodePaletteItem } from './BaseNodePalette'

interface ArchitectureNodePaletteProps {
  readonly onAddNode: (type: string, position?: { x: number; y: number }) => void
  readonly className?: string
}

// Icon components to avoid creating components inside render
const iconComponents = {
  // Infrastructure
  server: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Server size={size} {...props} />,
  database: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Database size={size} {...props} />,
  // canonical: 'load-balancer'
  loadBalancer: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Network size={size} {...props} />, 
  cdn: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Globe size={size} {...props} />,
  cache: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <HardDrive size={size} {...props} />,
  
  // Services
  microservice: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Package size={size} {...props} />,
  api: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Globe size={size} {...props} />,
  queue: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Package size={size} {...props} />,
  storage: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Database size={size} {...props} />,
  
  // Cloud Services
  cloudfunction: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Cloud size={size} {...props} />,
  container: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Package size={size} {...props} />,
  kubernetes: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Layers size={size} {...props} />,
  
  // Security
  firewall: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Shield size={size} {...props} />,
  auth: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Lock size={size} {...props} />,
  
  // External Systems
  external: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Globe size={size} {...props} />,
  thirdparty: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Package size={size} {...props} />,
  
  // Client Applications
  webapp: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Monitor size={size} {...props} />,
  mobile: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Smartphone size={size} {...props} />,
  tablet: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Tablet size={size} {...props} />,
  
  // Data Flow
  processor: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Cpu size={size} {...props} />,
  pipeline: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <GitBranch size={size} {...props} />,
  
  // Documentation
  documentation: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <FileText size={size} {...props} />,
  team: ({ size = 16, ...props }: { size?: number | string; [key: string]: unknown }) => <Users size={size} {...props} />,
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
      type: 'load-balancer', 
      label: 'Load Balancer', 
      icon: iconComponents.loadBalancer, 
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
      type: 'rest-api', 
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
      nodes={architectureNodes}
      onAddNode={onAddNode}
      categories={categories}
      enableSearch={true}
      enableCategoryFilter={true}
      className={`architecture-node-palette ${className}`}
    />
  )
}
