// import React from 'react'
// import * as d3 from 'd3'
import { NodeRenderProps, DefaultTheme, getNodeDimensions } from '../NodeRenderer'
import { getNodeColor, getNodeIcon, getPortColor } from '../../../utils/node-utils'

export function StandardNode(props: NodeRenderProps) {
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
  
  // Standard layout with header area
  const headerHeight = 30
  const contentStartY = 10
  
  return (
    <g className="standard-node" data-node-id={node.id}>
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

      {/* Header Background */}
      <rect
        className="node-header"
        x={-dimensions.width / 2}
        y={-dimensions.height / 2}
        width={dimensions.width}
        height={headerHeight}
        rx={finalTheme.borderRadius}
        fill={getNodeColor(node.type, node.status)}
        fillOpacity={0.1}
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

      {/* Header Content */}
      <g className="node-header-content">
        {showIcon && (
          <text
            className="node-icon"
            x={-dimensions.width / 2 + 15}
            y={-dimensions.height / 2 + headerHeight / 2 + 2}
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
            x={showIcon ? -dimensions.width / 2 + 40 : 0}
            y={-dimensions.height / 2 + headerHeight / 2 + 2}
            fontSize={dimensions.fontSize}
            fontWeight="600"
            textAnchor={showIcon ? "start" : "middle"}
            dominantBaseline="middle"
            fill={finalTheme.textColor}
          >
            {truncateText(node.label, dimensions.width - (showIcon ? 60 : 30))}
          </text>
        )}
      </g>

      {/* Node Type Label */}
      <text
        className="node-type"
        x={0}
        y={-dimensions.height / 2 + headerHeight + 15}
        fontSize={dimensions.fontSize - 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={finalTheme.textColor}
        opacity={0.7}
      >
        {node.type}
      </text>

      {/* Input Ports */}
      {showPorts && node.inputs.map((input, index) => {
        const portY = contentStartY + index * 25
        return (
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
              cy={portY}
              r={dimensions.portRadius}
              fill={getPortFillColor(input.dataType, isConnecting)}
              stroke={getPortStrokeColor(input.dataType, isConnecting)}
              strokeWidth={2}
            />
            
            {/* Port label */}
            <text
              x={-dimensions.width / 2 + dimensions.portRadius + 6}
              y={portY}
              fontSize={dimensions.fontSize - 2}
              dominantBaseline="middle"
              fill={finalTheme.textColor}
              opacity={0.8}
            >
              {input.label}
            </text>
          </g>
        )
      })}

      {/* Output Ports */}
      {showPorts && node.outputs.map((output, index) => {
        const portY = contentStartY + index * 25
        return (
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
              cy={portY}
              r={dimensions.portRadius}
              fill={getPortColor(output.dataType)}
              stroke="#333"
              strokeWidth={2}
            />
            
            {/* Port label */}
            <text
              x={dimensions.width / 2 - dimensions.portRadius - 6}
              y={portY}
              fontSize={dimensions.fontSize - 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={finalTheme.textColor}
              opacity={0.8}
            >
              {output.label}
            </text>
          </g>
        )
      })}
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
  return text.length > maxChars ? text.substring(0, maxChars - 3) + '...' : text
}