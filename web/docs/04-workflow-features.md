# Workflow Features - f1ow Workflow Engine Frontend

## 🔄 Workflow Automation Capabilities

f1ow Workflow Engine ให้ความสามารถในการสร้างและจัดการ business process automation ที่ซับซ้อนผ่าน intuitive visual interface

## 🎯 Core Workflow Concepts

### 1. Workflow Structure

#### Basic Components
```typescript
interface Workflow {
  id: string
  name: string
  description?: string
  version: string
  nodes: WorkflowNode[]
  connections: Connection[]
  triggers: WorkflowTrigger[]
  variables: Record<string, any>
  metadata: WorkflowMetadata
}

interface WorkflowNode {
  id: string
  type: string
  name: string
  position: { x: number; y: number }
  config: Record<string, any>
  inputs: NodeInput[]
  outputs: NodeOutput[]
}

interface Connection {
  id: string
  from: { nodeId: string; outputId: string }
  to: { nodeId: string; inputId: string }
  condition?: string
}
```

#### Workflow Lifecycle
```
Draft → Validation → Testing → Deployment → Execution → Monitoring
```

### 2. Node Type System

#### Control Flow Nodes
```typescript
// Start Node - เริ่มต้น workflow
interface StartNode {
  type: 'start'
  config: {
    triggerType: 'manual' | 'scheduled' | 'webhook' | 'event'
    scheduleExpression?: string // Cron expression
    webhookPath?: string
  }
}

// End Node - จบ workflow
interface EndNode {
  type: 'end'
  config: {
    status: 'success' | 'failure' | 'cancelled'
    output?: any
    notification?: NotificationConfig
  }
}

// Conditional Node - Logic branching
interface ConditionalNode {
  type: 'if'
  config: {
    condition: string // JavaScript expression
    branches: {
      true: string    // Output connection ID
      false: string   // Output connection ID
    }
  }
}

// Switch Node - Multiple path selection
interface SwitchNode {
  type: 'switch'
  config: {
    expression: string
    cases: Array<{
      value: any
      outputId: string
    }>
    defaultOutputId: string
  }
}
```

#### Processing Nodes
```typescript
// HTTP Request Node
interface HTTPNode {
  type: 'http'
  config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    url: string
    headers: Record<string, string>
    body?: string
    timeout: number
    retryPolicy: {
      maxRetries: number
      retryDelay: number
      backoffMultiplier: number
    }
    authentication?: {
      type: 'bearer' | 'basic' | 'api-key'
      credentials: Record<string, string>
    }
  }
}

// Transform Node - Data manipulation
interface TransformNode {
  type: 'transform'
  config: {
    transformType: 'javascript' | 'jq' | 'jsonata'
    expression: string
    schema?: JSONSchema
    validation: boolean
  }
}

// Filter Node - Data filtering
interface FilterNode {
  type: 'filter'
  config: {
    filterExpression: string
    mode: 'include' | 'exclude'
    arrayHandling: 'all' | 'first' | 'any'
  }
}
```

#### Integration Nodes
```typescript
// Database Node
interface DatabaseNode {
  type: 'database'
  config: {
    connection: {
      type: 'postgres' | 'mysql' | 'mongodb' | 'redis'
      connectionString: string
      ssl?: boolean
    }
    operation: 'select' | 'insert' | 'update' | 'delete'
    query: string
    parameters: Record<string, any>
  }
}

// Email Node
interface EmailNode {
  type: 'email'
  config: {
    provider: 'smtp' | 'sendgrid' | 'ses'
    to: string[]
    cc?: string[]
    subject: string
    template: {
      type: 'html' | 'text' | 'template-id'
      content: string
    }
    attachments?: Array<{
      filename: string
      content: string | Buffer
      contentType: string
    }>
  }
}

// Webhook Node
interface WebhookNode {
  type: 'webhook'
  config: {
    url: string
    method: 'POST' | 'PUT'
    headers: Record<string, string>
    payload: string
    signature?: {
      algorithm: 'sha256' | 'sha1'
      secret: string
      header: string
    }
  }
}
```

## 🎨 Visual Workflow Designer

### 1. Canvas Operations

#### Node Management
```typescript
const WorkflowCanvas = () => {
  const { addNode, updateNode, deleteNode, selectNode } = useWorkflowContext()
  
  // Add node from palette
  const handleNodeDrop = useCallback((nodeType: string, position: Position) => {
    const newNode: WorkflowNode = {
      id: generateId(),
      type: nodeType,
      name: getDefaultNodeName(nodeType),
      position,
      config: getDefaultNodeConfig(nodeType),
      inputs: getNodeInputs(nodeType),
      outputs: getNodeOutputs(nodeType)
    }
    addNode(newNode)
  }, [addNode])
  
  // Update node position during drag
  const handleNodeMove = useCallback((nodeId: string, position: Position) => {
    updateNode(nodeId, { position })
  }, [updateNode])
  
  return (
    <svg className="workflow-canvas">
      {/* Node rendering */}
      {nodes.map(node => (
        <NodeComponent
          key={node.id}
          node={node}
          onMove={handleNodeMove}
          onSelect={selectNode}
          onDelete={() => deleteNode(node.id)}
        />
      ))}
      
      {/* Connection rendering */}
      {connections.map(connection => (
        <ConnectionPath
          key={connection.id}
          connection={connection}
          nodes={nodes}
        />
      ))}
    </svg>
  )
}
```

#### Advanced Connection System

The connection system implements sophisticated path routing algorithms with performance optimizations:

```typescript
interface ConnectionManager {
  // Create connection between nodes
  createConnection: (
    fromNodeId: string, 
    fromOutputId: string,
    toNodeId: string, 
    toInputId: string
  ) => void
  
  // Validate connection compatibility
  validateConnection: (
    fromNode: WorkflowNode,
    fromOutput: NodeOutput,
    toNode: WorkflowNode,
    toInput: NodeInput
  ) => boolean
  
  // Auto-route connection paths with mode-specific algorithms
  calculatePath: (
    fromPosition: Position,
    toPosition: Position,
    pathType: 'bezier' | 'orthogonal' | 'u-shape',
    options?: {
      avoidNodes?: WorkflowNode[]
      adaptiveLeadLength?: boolean
      cacheKey?: string
    }
  ) => string
  
  // Performance optimization features
  caching: {
    pathCache: Map<string, string>
    geometryCache: Map<string, NodeGeometry>
    invalidateNode: (nodeId: string) => void
    performCleanup: () => void
  }
}

// Connection validation rules
const validateConnection = (
  fromNode: WorkflowNode, fromOutput: NodeOutput,
  toNode: WorkflowNode, toInput: NodeInput
): boolean => {
  // Type compatibility
  if (!isTypeCompatible(fromOutput.type, toInput.type)) {
    return false
  }
  
  // Prevent self-connections
  if (fromNode.id === toNode.id) {
    return false
  }
  
  // Prevent circular dependencies
  if (wouldCreateCircle(fromNode.id, toNode.id)) {
    return false
  }
  
  // Single input constraint
  if (toInput.multiple === false && hasExistingConnection(toNode.id, toInput.id)) {
    return false
  }
  
  return true
}
```

### 2. Node Configuration

#### Dynamic Form Generation
```typescript
interface NodeSchema {
  type: string
  properties: Record<string, PropertySchema>
  required: string[]
  groups?: Array<{
    name: string
    properties: string[]
    expanded?: boolean
  }>
}

interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  title: string
  description?: string
  default?: any
  enum?: any[]
  format?: 'email' | 'url' | 'date' | 'code' | 'expression'
  validation?: {
    pattern?: string
    minLength?: number
    maxLength?: number
    minimum?: number
    maximum?: number
  }
}

// Example: HTTP Node schema
const httpNodeSchema: NodeSchema = {
  type: 'http',
  properties: {
    method: {
      type: 'string',
      title: 'HTTP Method',
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      default: 'GET'
    },
    url: {
      type: 'string',
      title: 'URL',
      format: 'url',
      validation: { pattern: '^https?://' }
    },
    headers: {
      type: 'object',
      title: 'Headers',
      description: 'HTTP headers as key-value pairs'
    },
    timeout: {
      type: 'number',
      title: 'Timeout (ms)',
      default: 30000,
      validation: { minimum: 1000, maximum: 300000 }
    }
  },
  required: ['url'],
  groups: [
    { name: 'Request', properties: ['method', 'url', 'headers'] },
    { name: 'Options', properties: ['timeout'], expanded: false }
  ]
}
```

#### Expression Editor Integration
```typescript
interface ExpressionEditor {
  // JavaScript expression support
  value: string
  onChange: (value: string) => void
  context: Record<string, any>
  
  // Features
  autocompletion: boolean
  syntaxHighlighting: boolean
  errorValidation: boolean
  
  // Context variables
  availableVariables: Array<{
    name: string
    type: string
    description: string
  }>
}

// Example: Expression context
const expressionContext = {
  // Previous node outputs
  $nodes: {
    httpRequest: { status: 200, data: { id: 1, name: 'John' } },
    transform: { processedData: [...] }
  },
  
  // Workflow variables
  $vars: {
    apiKey: 'secret-key',
    baseUrl: 'https://api.example.com'
  },
  
  // Built-in functions
  $fn: {
    now: () => new Date().toISOString(),
    uuid: () => crypto.randomUUID(),
    hash: (data: string) => crypto.createHash('sha256').update(data).digest('hex')
  }
}
```

## 🚀 Workflow Execution

### 1. Execution Engine Integration

#### Execution States
```typescript
interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  
  // Node execution states
  nodeExecutions: Record<string, NodeExecution>
  
  // Execution context
  variables: Record<string, any>
  errors: ExecutionError[]
  
  // Progress tracking
  progress: {
    total: number
    completed: number
    percentage: number
  }
}

interface NodeExecution {
  nodeId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime?: string
  endTime?: string
  duration?: number
  input?: any
  output?: any
  error?: ExecutionError
  retryCount: number
}
```

#### Real-time Execution Monitoring
```typescript
const ExecutionMonitor = ({ executionId }: { executionId: string }) => {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null)
  
  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket(`ws://localhost:8080/executions/${executionId}`)
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      
      switch (update.type) {
        case 'execution_started':
          setExecution(update.execution)
          break
          
        case 'node_started':
          setExecution(prev => ({
            ...prev!,
            nodeExecutions: {
              ...prev!.nodeExecutions,
              [update.nodeId]: {
                ...prev!.nodeExecutions[update.nodeId],
                status: 'running',
                startTime: update.startTime
              }
            }
          }))
          break
          
        case 'node_completed':
          setExecution(prev => ({
            ...prev!,
            nodeExecutions: {
              ...prev!.nodeExecutions,
              [update.nodeId]: {
                ...prev!.nodeExecutions[update.nodeId],
                status: 'completed',
                endTime: update.endTime,
                output: update.output
              }
            }
          }))
          break
      }
    }
    
    return () => ws.close()
  }, [executionId])
  
  return (
    <div className="execution-monitor">
      <ExecutionHeader execution={execution} />
      <ExecutionProgress execution={execution} />
      <NodeExecutionList execution={execution} />
    </div>
  )
}
```

### 2. Error Handling & Debugging

#### Error Management
```typescript
interface ExecutionError {
  id: string
  nodeId: string
  type: 'validation' | 'runtime' | 'timeout' | 'connection' | 'transformation'
  message: string
  details?: Record<string, any>
  stackTrace?: string
  timestamp: string
  
  // Recovery options
  recoverable: boolean
  suggestedActions: string[]
}

// Error handling strategies
const errorHandlingStrategies = {
  // Retry with exponential backoff
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000
  },
  
  // Circuit breaker pattern
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    monitoringWindow: 300000
  },
  
  // Fallback mechanisms
  fallback: {
    defaultValue: null,
    alternativeFlow: 'error-handler-node-id',
    notificationChannels: ['email', 'slack']
  }
}
```

#### Debug Mode
```typescript
interface DebugSession {
  workflowId: string
  breakpoints: Array<{
    nodeId: string
    condition?: string
    enabled: boolean
  }>
  stepMode: boolean
  currentNode?: string
  
  // Debug data
  variableInspection: Record<string, any>
  executionTrace: ExecutionStep[]
}

const WorkflowDebugger = () => {
  const [debugSession, setDebugSession] = useState<DebugSession | null>(null)
  
  const startDebugSession = useCallback((workflowId: string) => {
    setDebugSession({
      workflowId,
      breakpoints: [],
      stepMode: false,
      variableInspection: {},
      executionTrace: []
    })
  }, [])
  
  const addBreakpoint = useCallback((nodeId: string, condition?: string) => {
    setDebugSession(prev => ({
      ...prev!,
      breakpoints: [
        ...prev!.breakpoints,
        { nodeId, condition, enabled: true }
      ]
    }))
  }, [])
  
  return (
    <div className="workflow-debugger">
      <DebugToolbar 
        session={debugSession}
        onStart={startDebugSession}
        onStep={() => {/* Step execution */}}
        onContinue={() => {/* Continue execution */}}
      />
      
      <BreakpointPanel
        breakpoints={debugSession?.breakpoints || []}
        onAdd={addBreakpoint}
        onToggle={(id) => {/* Toggle breakpoint */}}
      />
      
      <VariableInspector
        variables={debugSession?.variableInspection || {}}
      />
    </div>
  )
}
```

## 📊 Workflow Analytics

### 1. Performance Metrics

#### Execution Analytics
```typescript
interface WorkflowAnalytics {
  // Performance metrics
  averageExecutionTime: number
  medianExecutionTime: number
  p95ExecutionTime: number
  throughput: number // executions per hour
  
  // Reliability metrics
  successRate: number
  errorRate: number
  retryRate: number
  
  // Node-level metrics
  nodePerformance: Record<string, {
    averageTime: number
    successRate: number
    errorCount: number
    bottleneckScore: number
  }>
  
  // Trend data
  trends: {
    executionTimes: TimeSeriesData[]
    errorRates: TimeSeriesData[]
    throughput: TimeSeriesData[]
  }
}

// Analytics dashboard
const AnalyticsDashboard = ({ workflowId }: { workflowId: string }) => {
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null)
  
  return (
    <div className="analytics-dashboard grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <MetricCard
        title="Success Rate"
        value={`${analytics?.successRate.toFixed(1)}%`}
        trend={analytics?.trends.errorRates}
        format="percentage"
      />
      
      <MetricCard
        title="Avg Execution Time"
        value={`${analytics?.averageExecutionTime}ms`}
        trend={analytics?.trends.executionTimes}
        format="duration"
      />
      
      <MetricCard
        title="Throughput"
        value={`${analytics?.throughput}/hr`}
        trend={analytics?.trends.throughput}
        format="number"
      />
      
      <BottleneckAnalysis
        nodePerformance={analytics?.nodePerformance || {}}
      />
      
      <ErrorAnalysis
        errors={analytics?.errors || []}
      />
    </div>
  )
}
```

### 2. Optimization Recommendations

#### Performance Optimization
```typescript
interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'cost' | 'maintainability'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: string
  effort: 'low' | 'medium' | 'high'
  
  // Implementation details
  implementation: {
    steps: string[]
    estimatedTime: string
    risks: string[]
  }
  
  // Expected improvements
  expectedImprovements: {
    performanceGain?: string
    costReduction?: string
    reliabilityIncrease?: string
  }
}

// Auto-generated optimization suggestions
const generateOptimizations = (
  workflow: Workflow, 
  analytics: WorkflowAnalytics
): OptimizationSuggestion[] => {
  const suggestions: OptimizationSuggestion[] = []
  
  // Identify bottleneck nodes
  Object.entries(analytics.nodePerformance).forEach(([nodeId, metrics]) => {
    if (metrics.bottleneckScore > 0.8) {
      suggestions.push({
        type: 'performance',
        severity: 'high',
        title: `Optimize ${getNodeName(nodeId)} performance`,
        description: `This node takes ${metrics.averageTime}ms on average, significantly slowing down the workflow.`,
        impact: `Reducing execution time by 50% could improve overall workflow performance by ${calculateImpact(nodeId, workflow)}%.`,
        effort: 'medium',
        implementation: {
          steps: [
            'Add caching layer',
            'Optimize database queries',
            'Implement connection pooling'
          ],
          estimatedTime: '2-4 hours',
          risks: ['Temporary service disruption during deployment']
        },
        expectedImprovements: {
          performanceGain: '40-60% faster execution'
        }
      })
    }
  })
  
  return suggestions
}
```

---

**Next**: [Architecture Features](./05-architecture-features.md) - System design และ architecture diagram capabilities
