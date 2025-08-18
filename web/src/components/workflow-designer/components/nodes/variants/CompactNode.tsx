// import { createElement } from 'react'
import type { NodeRenderProps} from '../NodeRenderer';
import { DefaultTheme, getNodeDimensions } from '../NodeRenderer'
import { getNodeColor, getNodeIcon, getPortColor } from '../../../utils/node-utils'

export function CompactNode(props: NodeRenderProps) {
  const {
    node,
    theme = DefaultTheme,
    isSelected = false,
    isConnecting = false,
    isDragging = false,
    showPorts = true,
    showLabel = true,
    showIcon = true,
    showStatus = true,
    onNodeClick,
    onNodeDoubleClick,
    onPortClick
    // onPortDragStart,
    // onPortDrag,
    // onPortDragEnd,
    // canDropOnPort,
    // canDropOnNode
  } = props

  const dimensions = getNodeDimensions(node)
  const finalTheme = { ...DefaultTheme, ...theme }
  
  // Calculate colors
  const backgroundColor = finalTheme.backgroundColor
  const borderColor = isSelected ? finalTheme.accentColor : getNodeColor(node.type, node.status)
  const borderWidth = isSelected ? 3 : finalTheme.borderWidth
  
  // Port positions for compact layout
  const inputPortY = dimensions.height / 2
  const outputPortY = dimensions.height / 2
  
  return (
    <g className="compact-node" data-node-id={node.id}>
      {/* Node Background */}
      <rect
        className="node-background"
        x={-dimensions.width / 2}
        y={-dimensions.height / 2}
        width={dimensions.width}
        height={dimensions.height}
        rx={finalTheme.borderRadius}
        fill={backgroundColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
        style={{
          filter: isDragging 
            ? `drop-shadow(0 4px 12px ${finalTheme.shadowColor})` 
            : isSelected 
              ? `drop-shadow(0 2px 8px ${finalTheme.accentColor}40)`
              : `drop-shadow(0 1px 3px ${finalTheme.shadowColor})`,
          cursor: 'move'
        }}
        onClick={(e: any) => {
          const ctrlKey = e.ctrlKey || e.metaKey
          onNodeClick?.(node, ctrlKey)
        }}
        onDoubleClick={() => onNodeDoubleClick?.(node)}
      />

      {/* Status Indicator */}
      {showStatus && node.status && node.status !== 'idle' && (
        <circle
          className="node-status"
          cx={dimensions.width / 2 - 12}
          cy={-dimensions.height / 2 + 12}
          r={4}
          fill={getStatusColor(node.status)}
        />
      )}

      {/* Icon and Label (side by side for compact) */}
      <g className="node-content">
        {showIcon && (
          <text
            className="node-icon"
            x={-dimensions.width / 2 + 15}
            y={5}
            fontSize={dimensions.iconSize}
            textAnchor="start"
            dominantBaseline="middle"
            fill={finalTheme.textColor}
          >
            {getNodeIcon(node.type)}
          </text>
        )}
        
        {showLabel && (
          <text
            className="node-label"
            x={showIcon ? -dimensions.width / 2 + 35 : 0}
            y={5}
            fontSize={dimensions.fontSize}
            fontWeight="600"
            textAnchor={showIcon ? "start" : "middle"}
            dominantBaseline="middle"
            fill={finalTheme.textColor}
          >
            {truncateText(node.label, dimensions.width - (showIcon ? 50 : 20))}
          </text>
        )}
      </g>

      {/* Input Ports */}
      {showPorts && node.inputs.map((input, index) => (
        <g
          key={`input-${input.id}`}
          className="input-port"
          style={{ cursor: 'crosshair' }}
          onClick={(e: any) => {
            e.stopPropagation()
            onPortClick?.(node.id, input.id, 'input')
          }}
        >
          <circle
            cx={-dimensions.width / 2}
            cy={inputPortY - (node.inputs.length - 1) * 15 + index * 30}
            r={dimensions.portRadius}
            fill={getPortFillColor(input.dataType, isConnecting)}
            stroke={getPortStrokeColor(input.dataType, isConnecting)}
            strokeWidth={2}
          />
          
          {/* Port label (only if not too many ports) */}
          {node.inputs.length <= 2 && (
            <text
              x={-dimensions.width / 2 + dimensions.portRadius + 4}
              y={inputPortY - (node.inputs.length - 1) * 15 + index * 30}
              fontSize={dimensions.fontSize - 1}
              dominantBaseline="middle"
              fill={finalTheme.textColor}
              opacity={0.7}
            >
              {input.label}
            </text>
          )}
        </g>
      ))}

      {/* Output Ports */}
      {showPorts && node.outputs.map((output, index) => (
        <g
          key={`output-${output.id}`}
          className="output-port"
          style={{ cursor: 'crosshair' }}
          onClick={(e: any) => {
            e.stopPropagation()
            onPortClick?.(node.id, output.id, 'output')
          }}
        >
          <circle
            cx={dimensions.width / 2}
            cy={outputPortY - (node.outputs.length - 1) * 15 + index * 30}
            r={dimensions.portRadius}
            fill={getPortColor(output.dataType)}
            stroke="#333"
            strokeWidth={2}
          />
          
          {/* Port label (only if not too many ports) */}
          {node.outputs.length <= 2 && (
            <text
              x={dimensions.width / 2 - dimensions.portRadius - 4}
              y={outputPortY - (node.outputs.length - 1) * 15 + index * 30}
              fontSize={dimensions.fontSize - 1}
              textAnchor="end"
              dominantBaseline="middle"
              fill={finalTheme.textColor}
              opacity={0.7}
            >
              {output.label}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#FFA726'
    case 'completed': return '#66BB6A'
    case 'error': return '#EF5350'
    case 'warning': return '#FFCA28'
    default: return '#9E9E9E'
  }
}

function getPortFillColor(dataType: string, isConnecting: boolean, canDrop?: boolean): string {
  if (isConnecting) {
    return canDrop ? '#4CAF50' : getPortColor(dataType)
  }
  return getPortColor(dataType)
}

function getPortStrokeColor(_dataType: string, isConnecting: boolean, canDrop?: boolean): string {
  if (isConnecting) {
    return canDrop ? '#4CAF50' : '#ff5722'
  }
  return '#333'
}

function truncateText(text: string, maxWidth: number): string {
  // Simple text truncation - in real implementation you'd measure text width
  const maxChars = Math.floor(maxWidth / 8) // Rough estimation
  return text.length > maxChars ? `${text.substring(0, maxChars - 3)  }...` : text
}