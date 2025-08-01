/**
 * Architecture Diagram Types
 * Type definitions for system architecture and API tracking features
 */

import type { WorkflowNode, NodeDefinition, NodeTypeInfo } from './index'

// Architecture diagram specific node categories
export type ArchitectureNodeCategory = 
  | 'System/External Service'
  | 'System/Internal Service' 
  | 'System/Database'
  | 'System/Queue'
  | 'System/Cache'
  | 'System/Gateway'
  | 'System/Load Balancer'
  | 'System/CDN'
  | 'API/REST Endpoint'
  | 'API/GraphQL Endpoint'
  | 'API/WebSocket'
  | 'API/Event Stream'
  | 'Business/Domain Service'
  | 'Business/Use Case'
  | 'Business/Process'
  | 'Infrastructure/Container'
  | 'Infrastructure/Cloud Service'
  | 'Infrastructure/Network'
  | 'Security/Authentication'
  | 'Security/Authorization'
  | 'Monitoring/Logging'
  | 'Monitoring/Metrics'

// API dependency tracking
export interface APIDependency {
  id: string
  sourceServiceId: string
  targetServiceId: string
  apiPath: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS'
  version?: string
  description?: string
  businessContext: string[]
  consumers: ServiceConsumer[]
  lastModified: number
  status: 'active' | 'deprecated' | 'planned' | 'legacy'
}

// Service consumer information
export interface ServiceConsumer {
  serviceId: string
  serviceName: string
  controllerClass?: string
  methodName?: string
  frequency: 'high' | 'medium' | 'low'
  criticality: 'critical' | 'important' | 'optional'
  businessFunction: string
  uiComponents?: string[]
  testCoverage?: number
}

// Architecture diagram node with extended properties
export interface ArchitectureNode extends Omit<WorkflowNode, 'category'> {
  category: ArchitectureNodeCategory
  serviceInfo?: {
    name: string
    version: string
    environment: 'production' | 'staging' | 'development'
    healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
    technology: string[]
    team: string
    repository?: string
    documentation?: string
  }
  apiInfo?: {
    baseUrl: string
    version: string
    authentication: 'none' | 'bearer' | 'api-key' | 'oauth2' | 'basic'
    rateLimiting?: {
      requests: number
      period: string
    }
    endpoints: APIEndpoint[]
    monitoring?: {
      healthCheck: string
      metrics: string[]
    }
  }
  businessInfo?: {
    domain: string
    purpose: string
    stakeholders: string[]
    sla?: {
      uptime: number
      responseTime: number
    }
  }
}

// API endpoint definition
export interface APIEndpoint {
  id: string
  path: string
  method: string
  summary: string
  operationId?: string
  tags: string[]
  parameters?: APIParameter[]
  requestBody?: APIRequestBody
  responses: APIResponse[]
  deprecated?: boolean
  businessContext: string[]
  consumers: string[]
  rateLimit?: number
}

// API parameter definition
export interface APIParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required: boolean
  type: string
  description?: string
  example?: any
}

// API request body
export interface APIRequestBody {
  description?: string
  required: boolean
  content: {
    [mediaType: string]: {
      schema: any
      example?: any
    }
  }
}

// API response definition
export interface APIResponse {
  statusCode: string
  description: string
  content?: {
    [mediaType: string]: {
      schema: any
      example?: any
    }
  }
}

// Impact analysis result
export interface ImpactAnalysis {
  apiEndpoint: APIEndpoint
  affectedServices: {
    serviceId: string
    serviceName: string
    impactLevel: 'high' | 'medium' | 'low'
    affectedComponents: string[]
    recommendedTests: string[]
    migrationSteps?: string[]
  }[]
  businessImpact: {
    affectedProcesses: string[]
    userJourneys: string[]
    estimatedDowntime?: number
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
  }
  totalAffectedServices: number
  totalAffectedUIComponents: number
  estimatedTestingEffort: number // in hours
}

// Diagram layout types
export interface ArchitectureDiagramLayout {
  type: 'layered' | 'cluster' | 'network' | 'service-mesh' | 'domain-driven'
  layers?: {
    id: string
    name: string
    y: number
    color: string
    nodeTypes: ArchitectureNodeCategory[]
  }[]
  clusters?: {
    id: string
    name: string
    bounds: { x: number; y: number; width: number; height: number }
    color: string
    nodeIds: string[]
  }[]
}

// Architecture node type definitions
export const ArchitectureNodeTypes: Record<string, NodeTypeInfo> = {
  // External Services
  'ext-service': {
    icon: '🌐',
    color: '#FF6B6B',
    label: 'External Service',
    category: 'System/External Service',
    description: 'Third-party external service',
    shape: 'rectangle'
  },
  
  'ext-api': {
    icon: '🔗',
    color: '#4ECDC4',
    label: 'External API',
    category: 'API/REST Endpoint',
    description: 'External API endpoint'
  },
  
  // Internal Services
  'microservice': {
    icon: '⚙️',
    color: '#45B7D1',
    label: 'Microservice',
    category: 'System/Internal Service',
    description: 'Internal microservice',
    shape: 'rectangle'
  },
  
  'api-gateway': {
    icon: '🚪',
    color: '#96CEB4',
    label: 'API Gateway',
    category: 'System/Gateway',
    description: 'API gateway service'
  },
  
  'load-balancer': {
    icon: '⚖️',
    color: '#FFEAA7',
    label: 'Load Balancer',
    category: 'System/Load Balancer',
    description: 'Load balancing service'
  },
  
  // Data Stores
  'database': {
    icon: '🗄️',
    color: '#6C5CE7',
    label: 'Database',
    category: 'System/Database',
    description: 'Database system',
    shape: 'circle'
  },
  
  'cache': {
    icon: '⚡',
    color: '#FD79A8',
    label: 'Cache',
    category: 'System/Cache',
    description: 'Caching layer',
    shape: 'diamond'
  },
  
  'message-queue': {
    icon: '📬',
    color: '#FDCB6E',
    label: 'Message Queue',
    category: 'System/Queue',
    description: 'Message queue system'
  },
  
  // API Types
  'rest-api': {
    icon: '🔄',
    color: '#00B894',
    label: 'REST API',
    category: 'API/REST Endpoint',
    description: 'REST API endpoint'
  },
  
  'graphql-api': {
    icon: '📊',
    color: '#E17055',
    label: 'GraphQL API',
    category: 'API/GraphQL Endpoint',
    description: 'GraphQL API endpoint'
  },
  
  'websocket': {
    icon: '🔌',
    color: '#A29BFE',
    label: 'WebSocket',
    category: 'API/WebSocket',
    description: 'WebSocket connection'
  },
  
  'event-stream': {
    icon: '🌊',
    color: '#FD79A8',
    label: 'Event Stream',
    category: 'API/Event Stream',
    description: 'Event streaming endpoint'
  },
  
  // Business Layer
  'domain-service': {
    icon: '💼',
    color: '#6C5CE7',
    label: 'Domain Service',
    category: 'Business/Domain Service',
    description: 'Business domain service'
  },
  
  'use-case': {
    icon: '🎯',
    color: '#00B894',
    label: 'Use Case',
    category: 'Business/Use Case',
    description: 'Business use case'
  },
  
  'business-process': {
    icon: '📋',
    color: '#FDCB6E',
    label: 'Business Process',
    category: 'Business/Process',
    description: 'Business process flow'
  },
  
  // Infrastructure
  'container': {
    icon: '📦',
    color: '#74B9FF',
    label: 'Container',
    category: 'Infrastructure/Container',
    description: 'Container/Pod'
  },
  
  'cloud-service': {
    icon: '☁️',
    color: '#0984E3',
    label: 'Cloud Service',
    category: 'Infrastructure/Cloud Service',
    description: 'Cloud platform service'
  },
  
  'cdn': {
    icon: '🌍',
    color: '#00CEC9',
    label: 'CDN',
    category: 'System/CDN',
    description: 'Content delivery network'
  },
  
  // Security
  'auth-service': {
    icon: '🔐',
    color: '#E84393',
    label: 'Auth Service',
    category: 'Security/Authentication',
    description: 'Authentication service'
  },
  
  'authorization': {
    icon: '🛡️',
    color: '#00B894',
    label: 'Authorization',
    category: 'Security/Authorization',
    description: 'Authorization service'
  },
  
  // Monitoring
  'logger': {
    icon: '📝',
    color: '#636E72',
    label: 'Logger',
    category: 'Monitoring/Logging',
    description: 'Logging service'
  },
  
  'metrics': {
    icon: '📊',
    color: '#A29BFE',
    label: 'Metrics',
    category: 'Monitoring/Metrics',
    description: 'Metrics collection'
  }
}

// Architecture node definitions
export const ArchitectureNodeDefinitions: Record<string, NodeDefinition> = {
  'microservice': {
    inputs: [
      { id: 'http-in', type: 'input', dataType: 'object', label: 'HTTP Request', required: false },
      { id: 'event-in', type: 'input', dataType: 'object', label: 'Event', required: false }
    ],
    outputs: [
      { id: 'http-out', type: 'output', dataType: 'object', label: 'HTTP Response' },
      { id: 'event-out', type: 'output', dataType: 'object', label: 'Event' }
    ],
    defaultConfig: {
      serviceName: '',
      version: '1.0.0',
      port: 8080,
      healthCheck: '/health',
      technology: ['Node.js'],
      team: ''
    },
    category: 'System/Internal Service',
    description: 'Internal microservice',
    icon: '⚙️',
    color: '#45B7D1'
  },
  
  'rest-api': {
    inputs: [
      { id: 'request', type: 'input', dataType: 'object', label: 'Request', required: true }
    ],
    outputs: [
      { id: 'response', type: 'output', dataType: 'object', label: 'Response' }
    ],
    defaultConfig: {
      method: 'GET',
      path: '/',
      operationId: '',
      tags: [],
      businessContext: [],
      consumers: []
    },
    category: 'API/REST Endpoint',
    description: 'REST API endpoint',
    icon: '🔄',
    color: '#00B894'
  },
  
  'database': {
    inputs: [
      { id: 'query', type: 'input', dataType: 'string', label: 'Query', required: true }
    ],
    outputs: [
      { id: 'result', type: 'output', dataType: 'object', label: 'Result' }
    ],
    defaultConfig: {
      type: 'PostgreSQL',
      host: '',
      database: '',
      connectionPool: 10
    },
    category: 'System/Database',
    description: 'Database system',
    icon: '🗄️',
    color: '#6C5CE7'
  },
  
  'ext-service': {
    inputs: [
      { id: 'request', type: 'input', dataType: 'object', label: 'Request', required: true }
    ],
    outputs: [
      { id: 'response', type: 'output', dataType: 'object', label: 'Response' }
    ],
    defaultConfig: {
      serviceName: '',
      baseUrl: '',
      authentication: 'none',
      rateLimit: 100
    },
    category: 'System/External Service',
    description: 'External third-party service',
    icon: '🌐',
    color: '#FF6B6B'
  }
}

// Layout presets
export const ArchitectureLayouts: Record<string, ArchitectureDiagramLayout> = {
  'microservices': {
    type: 'layered',
    layers: [
      {
        id: 'presentation',
        name: 'Presentation Layer',
        y: 50,
        color: '#E8F4FD',
        nodeTypes: ['System/Gateway', 'System/Load Balancer', 'System/CDN']
      },
      {
        id: 'business',
        name: 'Business Layer', 
        y: 200,
        color: '#FFF2E8',
        nodeTypes: ['System/Internal Service', 'Business/Domain Service', 'Business/Use Case']
      },
      {
        id: 'data',
        name: 'Data Layer',
        y: 350,
        color: '#E8F5E8',
        nodeTypes: ['System/Database', 'System/Cache', 'System/Queue']
      },
      {
        id: 'external',
        name: 'External Services',
        y: 500,
        color: '#FDE8E8',
        nodeTypes: ['System/External Service']
      }
    ]
  },
  
  'api-first': {
    type: 'cluster',
    clusters: [
      {
        id: 'api-layer',
        name: 'API Layer',
        bounds: { x: 50, y: 50, width: 600, height: 150 },
        color: '#E8F4FD',
        nodeIds: []
      },
      {
        id: 'services',
        name: 'Services',
        bounds: { x: 50, y: 250, width: 600, height: 200 },
        color: '#FFF2E8',
        nodeIds: []
      },
      {
        id: 'persistence',
        name: 'Persistence',
        bounds: { x: 50, y: 500, width: 600, height: 100 },
        color: '#E8F5E8',
        nodeIds: []
      }
    ]
  }
}
