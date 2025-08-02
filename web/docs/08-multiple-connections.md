# Multiple Connections Support - f1ow Workflow Engine

## 🎯 Overview

The f1ow Workflow Engine now supports multiple connections between nodes in **Architecture Mode**, enabling better support for legacy systems and complex architectural patterns.

## 🏗️ Architecture Mode vs Workflow Mode

### Workflow Mode (Default)
- **Strict validation**: One connection per input port
- **Optimized for**: Sequential workflow processing
- **Use case**: Data processing pipelines, ETL workflows

### Architecture Mode 
- **Relaxed validation**: Multiple connections to same port allowed
- **Optimized for**: System architecture design, legacy system integration
- **Use case**: Microservices architecture, API gateway patterns, legacy system endpoints

## 🔄 Connection Rules by Mode

### Workflow Mode Rules
```typescript
// Input ports: Only one connection allowed
targetPort.connections.length <= 1

// Output ports: Multiple connections allowed
sourcePort.connections.length >= 0

// Special ports (ai-model): Single connection only
aiModelPort.connections.length <= 1
```

### Architecture Mode Rules
```typescript
// Input ports: Multiple connections allowed (legacy endpoint support)
targetPort.connections.length >= 0

// Output ports: Multiple connections allowed
sourcePort.connections.length >= 0

// Special ports: Configurable based on port definition
specialPort.allowMultiple ? unlimited : 1
```

## 🎛️ Port Configuration

### Legacy Endpoint Support
```typescript
// Define a node with multiple endpoint support
const legacyServiceNode = {
  id: 'legacy-service-1',
  type: 'legacy-service',
  inputs: [
    {
      id: 'endpoint-a',
      label: 'Legacy Endpoint A',
      dataType: 'array', // Allows multiple connections
      allowMultiple: true
    },
    {
      id: 'endpoint-b', 
      label: 'Legacy Endpoint B',
      dataType: 'array',
      allowMultiple: true
    }
  ]
}
```

### Single Connection Ports
```typescript
// Force single connection even in architecture mode
const singleConnectionPort = {
  id: 'ai-model',
  label: 'AI Model (single)',
  dataType: 'object',
  allowMultiple: false
}
```

## 🔧 Implementation Details

### Connection Validation
```typescript
// useWorkflowOperations.ts
const createConnection = (sourceNodeId, sourcePortId, targetNodeId, targetPortId) => {
  const isArchitectureMode = state.designerMode === 'architecture'
  
  if (isArchitectureMode) {
    // Allow multiple connections (legacy support)
    return validateArchitectureModeConnection(...)
  } else {
    // Strict workflow validation
    return validateWorkflowModeConnection(...)
  }
}
```

### Visual Feedback
```typescript
// WorkflowCanvas.tsx - Port highlighting
nodeElement.selectAll('.input-port')
  .classed('drop-target-port', function(portData) {
    if (workflowContextState.designerMode === 'architecture') {
      // Only prevent exact duplicates
      return !isExactDuplicateConnection(portData)
    } else {
      // Prevent any connection to occupied port
      return !isPortConnected(portData)
    }
  })
```

## 📋 Usage Examples

### Legacy System Integration
```typescript
// Architecture mode: Connect multiple services to legacy endpoint
const legacyIntegration = {
  connections: [
    {
      source: 'service-a',
      sourcePort: 'output',
      target: 'legacy-system',
      targetPort: 'endpoint-1' // Multiple connections allowed
    },
    {
      source: 'service-b', 
      sourcePort: 'output',
      target: 'legacy-system',
      targetPort: 'endpoint-1' // Same port, different source
    },
    {
      source: 'service-c',
      sourcePort: 'output', 
      target: 'legacy-system',
      targetPort: 'endpoint-2' // Different endpoint
    }
  ]
}
```

### API Gateway Pattern
```typescript
// Multiple services connecting to API gateway
const apiGatewayPattern = {
  connections: [
    // Multiple microservices → API Gateway
    { source: 'user-service', target: 'api-gateway', targetPort: 'services' },
    { source: 'order-service', target: 'api-gateway', targetPort: 'services' },
    { source: 'payment-service', target: 'api-gateway', targetPort: 'services' },
    
    // API Gateway → Load Balancer
    { source: 'api-gateway', target: 'load-balancer', targetPort: 'upstream' }
  ]
}
```

## 🔍 Visual Indicators

### Port States
- **Available**: Green highlight when can accept connection
- **Connected (Workflow)**: No highlight (blocked)
- **Connected (Architecture)**: Yellow highlight (can accept more)
- **Legacy Endpoint**: Blue outline indicating multiple endpoint support

### Connection Styles
- **Workflow Mode**: Solid lines, distinct colors
- **Architecture Mode**: Dashed lines for legacy connections
- **Multiple Connections**: Slightly transparent to show overlapping

## 🚀 Best Practices

### When to Use Architecture Mode
✅ **Good for:**
- Legacy system documentation
- Architecture diagrams
- System integration planning
- Multiple endpoint scenarios

❌ **Avoid for:**
- Production workflows
- Data processing pipelines
- Real-time execution

### Port Design Guidelines
```typescript
// ✅ Good: Clear labeling for multiple endpoints
{
  id: 'legacy-endpoints',
  label: 'Legacy Endpoints (multiple)',
  dataType: 'array',
  allowMultiple: true
}

// ❌ Avoid: Ambiguous single connection ports
{
  id: 'input',
  label: 'Input',
  dataType: 'any'
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Connections not creating in Architecture mode**
   - Check if `designerMode === 'architecture'` 
   - Verify `canDropOnPort` validation logic

2. **Too many connections in Workflow mode**
   - Switch to Architecture mode for legacy scenarios
   - Use array-type ports for legitimate multiple connections

3. **Performance with many connections**
   - Limit connections per port (recommended: <10)
   - Use connection batching for bulk operations

### Debug Commands
```javascript
// Check current mode
console.log('Current mode:', state.designerMode)

// List connections for debugging
console.log('All connections:', state.connections)

// Validate connection rules
console.log('Can create connection:', canDropOnPort(targetNodeId, targetPortId))
```

## 📊 Performance Considerations

- **Memory**: Each connection adds ~200 bytes
- **Rendering**: Complex connection graphs may impact canvas performance
- **Validation**: Architecture mode has relaxed validation (faster)
- **Recommended limits**: 
  - Workflow mode: <100 connections
  - Architecture mode: <500 connections
  - Per port: <10 connections

---

*This feature enables f1ow to better support legacy system integration and complex architectural patterns while maintaining strict validation for production workflows.*
