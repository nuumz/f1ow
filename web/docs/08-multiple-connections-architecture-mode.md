# Multiple Connections in Architecture Mode

## 🎯 Overview

The f1ow Workflow Engine now supports multiple connections between nodes in **Architecture Mode**, specifically designed to accommodate legacy systems with multiple endpoints and complex architectural patterns.

## 🚀 Key Features

### 1. **Enhanced Connection Validation**

- **Workflow Mode**: Strict validation - single connection per input port
- **Architecture Mode**: Flexible validation with advanced legacy system detection
  - Enhanced legacy endpoint detection based on multiple criteria
  - Intelligent port capacity management
  - Automatic connection grouping and organization

### 2. **Advanced Visual Feedback**

- **Multi-Connection Indicators**: Ports with multiple connections display special visual cues
- **Legacy Endpoint Badges**: Prominent "LEGACY" badges for identified legacy systems
- **Dynamic Port Capacity Indicators**: Real-time connection count display
- **Connection Labels**: Descriptive labels for different endpoint types
- **Smart Port Highlighting**: Context-aware port highlighting based on connection rules

### 3. **Intelligent Legacy System Detection**

Enhanced automatic detection criteria:

- Nodes with many input/output ports (>3)
- Nodes explicitly marked as `isLegacyEndpoint` in config
- Node types containing 'legacy' (e.g., `legacy-api`, `legacy-service`)
- Nodes with multiple existing connections (>2)
- Metadata-based legacy categorization

### 4. **Connection Path Optimization**

- **Automatic Path Offsetting**: Multiple connections between same nodes are visually separated
- **Collision Avoidance**: Smart routing prevents connection overlap
- **Visual Differentiation**: Different line styles for multiple connections (solid, dashed, dotted)
- **Connection Grouping**: Visual grouping of related connections

#### Architecture Pathing Details

- Paths are generated via an adaptive orthogonal router with rounded corners.
- For “short horizontal” layouts, U-shape routing keeps the termination side consistent (left→left, right→right).
- Bottom-to-bottom approaches use a U-shape under both nodes to maintain clarity.
- Arrowheads are trimmed outward (~5.5px) to avoid entering node frames.

## 🎨 Visual Elements

### Enhanced Connection Styles in Architecture Mode

```css
/* Multiple connection indicators */
.has-multiple-connections .input-port-circle {
  fill: #ff9800 !important; /* Orange for multi-connection ports */
  stroke: #f57c00 !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 2px 10px rgba(255, 152, 0, 0.5));
}

/* Legacy endpoint badge */
.legacy-badge-group {
  position: absolute;
  z-index: 10;
}

.legacy-badge-bg {
  fill: #9c27b0;
  stroke: #7b1fa2;
  stroke-width: 1;
  rx: 3;
}

.legacy-badge-text {
  fill: white;
  font-size: 9px;
  font-weight: bold;
  text-anchor: middle;
}

/* Port capacity indicators */
.port-capacity-indicator {
  font-size: 9px;
  fill: #666;
  pointer-events: none;
  text-anchor: middle;
}

/* Connection path variations */
.connection-path.multiple-connection {
  animation: connectionFlow 3s linear infinite;
}

.connection-path.multiple-connection.secondary {
  stroke-dasharray: 5, 5;
  animation: dashFlow 2s linear infinite;
}

.connection-path.multiple-connection.tertiary {
  stroke-dasharray: 3, 7;
  animation: dashFlow 1.5s linear infinite reverse;
}

/* Connection labels */
.connection-label {
  font-size: 10px;
  font-weight: bold;
  fill: #555;
  text-anchor: middle;
  pointer-events: none;
}
```

### Port Animations

- **Drop Target Pulse**: Animated feedback for valid drop targets
- **Architecture Pulse**: Special animation for selected connections in architecture mode

## 🔧 Implementation Details

### Connection Validation Rules

#### Workflow Mode (Default)

```typescript
// Single connection per input port
if (targetPortConnected) {
  return false; // Reject if port already connected
}
```

#### Architecture Mode (Enhanced)

```typescript
// Enhanced legacy system detection
const isLegacyTarget =
  targetNode &&
  (targetNode.config?.isLegacyEndpoint ||
    targetNode.type?.includes("legacy") ||
    (targetNode.inputs && targetNode.inputs.length > 3) ||
    state.connections.filter((c) => c.targetNodeId === targetNodeId).length >=
      2);

// Allow multiple connections for legacy systems
if (isLegacyTarget || isLegacySource) {
  console.log(
    "🏗️ Architecture mode: Allowing multiple connections for legacy system"
  );
  return true;
}

// Prevent only exact duplicate connections
if (exactDuplicateExists) {
  return false;
}

// Allow multiple different connections to same port
return true;
```

### Bottom Port Rules

#### Workflow Mode

- `ai-model`: Single connection only
- `memory`: Single connection only
- `tool`: Multiple connections (array type)
- Array types: Multiple connections
- Single types: Single connection only

#### Architecture Mode

- `ai-model`: Multiple connections allowed (model versions/fallbacks)
- `memory`: Multiple connections allowed (multiple stores)
- `tool`: Always multiple connections
- Most ports: Multiple connections unless marked as `single-connection`

## 📝 Usage Examples

### 1. **Legacy API Integration**

```json
{
  "type": "legacy-api",
  "config": {
    "isLegacyEndpoint": true
  },
  "inputs": [
    { "id": "endpoint1", "label": "Auth Endpoint" },
    { "id": "endpoint2", "label": "Data Endpoint" },
    { "id": "endpoint3", "label": "Callback Endpoint" },
    { "id": "endpoint4", "label": "Webhook Endpoint" }
  ]
}
```

### 2. **Multiple Model Connections**

In architecture mode, AI model nodes can connect to multiple sources:

- Primary model
- Fallback model
- A/B testing variants
- Different model versions

### 3. **Service Mesh Architecture**

- Load balancers connecting to multiple services
- API gateways with multiple upstream services
- Message queues with multiple consumers/producers

## ⚡ Performance Considerations

### Connection Caching

- Efficient connection lookup using Maps
- Batched visual updates during drag operations
- Optimized re-rendering for large architectures

### Memory Management

- Automatic cleanup of connection caches
- Efficient DOM manipulation using D3.js selections
- Minimal re-renders through React.memo optimization

## 🎮 User Experience

### Interaction Patterns

1. **Mode Switching**: Toggle between Workflow and Architecture modes
2. **Visual Feedback**: Real-time feedback during connection attempts
3. **Smart Dropping**: Automatic port selection for node-level drops
4. **Batch Operations**: Efficient handling of multiple connections

### Keyboard Shortcuts

- **Shift + Click**: Multi-select nodes (existing)
- **Ctrl/Cmd + A**: Select all nodes (existing)
- **Delete**: Remove selected connections/nodes (existing)

## 🔍 Debugging & Troubleshooting

### Console Logs

The system provides detailed logging for connection operations:

```javascript
console.log(
  "📍 Node background drop (architecture mode) - connecting to port:",
  nodeId,
  portId
);
console.log("🔍 Port canAccept=true, hasConnection=false");
```

### Common Issues

1. **Connections Not Appearing**

   - Check if in correct mode (Architecture vs Workflow)
   - Verify node types support multiple connections
   - Check console for validation errors

2. **Port Highlighting Issues**

   - Ensure proper hover states
   - Check CSS class application
   - Verify designer mode state

3. **Performance Issues**
   - Monitor connection count (>100 connections may impact performance)
   - Check for memory leaks in connection cache
   - Optimize node count per canvas

## 🚀 Future Enhancements

### Planned Features

1. **Connection Grouping**: Group related connections visually
2. **Connection Labels**: Add labels to connections for clarity
3. **Path Optimization**: Smart routing for multiple connections
4. **Connection Templates**: Pre-defined connection patterns for common architectures

### API Extensions

1. **Bulk Connection Operations**: Create/delete multiple connections
2. **Connection Validation Hooks**: Custom validation rules
3. **Connection Analytics**: Track connection usage patterns
4. **Export/Import**: Save and restore complex architectures

## 📊 Metrics & Analytics

### Connection Statistics

- Total connections per mode
- Average connections per node
- Most connected nodes
- Legacy endpoint identification rate

### Performance Metrics

- Connection creation time
- Rendering performance with multiple connections
- Memory usage patterns
- User interaction efficiency

---

**Note**: This feature is specifically designed for architectural design patterns and legacy system integration. For standard workflow design, continue using Workflow Mode for optimal validation and user experience.
