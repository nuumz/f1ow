import { useState, useRef, useEffect, useCallback } from 'react'
import * as d3 from 'd3'
import { Save, Play, ZoomIn, ZoomOut, Download, Upload, Maximize2, Eye, EyeOff, Trash2, RotateCcw } from 'lucide-react'
import NodePalette from './NodePalette'
import NodeEditor from './NodeEditor'

// Enhanced interfaces
interface NodePort {
  id: string
  type: 'input' | 'output'
  dataType: string
  label: string
  required?: boolean
  multiple?: boolean
  connected?: boolean
}

interface WorkflowNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  width?: number
  height?: number
  config: any
  inputs: NodePort[]
  outputs: NodePort[]
  status?: 'idle' | 'running' | 'completed' | 'error' | 'warning'
  data?: any
  locked?: boolean
  selected?: boolean
  group?: string
  metadata?: {
    description?: string
    version?: string
    author?: string
    tags?: string[]
  }
  // Temporary drag state
  dragStartX?: number
  dragStartY?: number
  initialX?: number
  initialY?: number
}

interface Connection {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  validated?: boolean
  dataFlow?: any
  style?: {
    color?: string
    strokeWidth?: number
    animated?: boolean
  }
}

interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'error' | 'paused'
  currentNode?: string
  completedNodes: string[]
  nodeData: Record<string, any>
  errors: Record<string, string>
  startTime?: number
  endTime?: number
  logs: Array<{
    nodeId: string
    timestamp: number
    level: 'info' | 'warning' | 'error'
    message: string
  }>
}

// Enhanced node type definitions
const NodeTypes = {
  http: { icon: '🌐', color: '#2196F3', label: 'HTTP Request' },
  transform: { icon: '🔄', color: '#4CAF50', label: 'Transform Data' },
  database: { icon: '🗄️', color: '#FF9800', label: 'Database' },
  conditional: { icon: '❓', color: '#9C27B0', label: 'Conditional' },
  loop: { icon: '🔁', color: '#00BCD4', label: 'Loop' },
  ai: { icon: '🤖', color: '#F44336', label: 'AI Agent' },
  email: { icon: '📧', color: '#795548', label: 'Email' },
  slack: { icon: '💬', color: '#4A154B', label: 'Slack' },
  schedule: { icon: '⏰', color: '#FFC107', label: 'Schedule' },
  webhook: { icon: '🔗', color: '#607D8B', label: 'Webhook' },
  subworkflow: { icon: '📦', color: '#E91E63', label: 'Sub-workflow' },
  parallel: { icon: '⚡', color: '#3F51B5', label: 'Parallel' }
}

// Constants
const NODE_WIDTH = 200
const NODE_MIN_HEIGHT = 80
const PORT_RADIUS = 6
const GRID_SIZE = 20

export default function AdvancedWorkflowDesigner() {
  // Core state
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set()) // Multi-select support
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false) // New state for controlling panel visibility
  const [workflowName, setWorkflowName] = useState('New Workflow')
  
  // Multi-select and group drag states
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [isGroupDragging, setIsGroupDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Map<string, {x: number, y: number}>>(new Map())
  const [isSelecting, setIsSelecting] = useState(false)
  
  // Execution state with proper initialization
  const [executionState, setExecutionState] = useState<ExecutionState>({ 
    status: 'idle', 
    completedNodes: [], 
    nodeData: {},
    errors: {},
    logs: []
  })
  
  // Canvas interaction states
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<{nodeId: string, portId: string, type: 'input' | 'output'} | null>(null)
  const [connectionPreview, setConnectionPreview] = useState<{x: number, y: number} | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1) // Keep for display purposes
  const zoomLevelRef = useRef(1)
  
  // 🚀 CANVAS TRANSFORM REF: จดจำ position และ zoom ของ canvas (ใช้ ref เพื่อหลีกเลี่ยง infinite loop)
  const getInitialCanvasTransform = () => {
    // โหลดจาก localStorage ถ้ามี
    const saved = localStorage.getItem(`workflow-canvas-transform-${workflowName}`)
    if (saved) {
      try {
        const { x, y, k } = JSON.parse(saved)
        return { x: x || 0, y: y || 0, k: k || 1 }
      } catch (e) {
        console.warn('Failed to parse saved canvas transform:', e)
      }
    }
    return { x: 0, y: 0, k: 1 }
  }
  
  const canvasTransformRef = useRef<{ x: number, y: number, k: number }>(getInitialCanvasTransform())
  
  // บันทึก canvas transform ลง localStorage
  const saveCanvasTransform = useCallback((transform: { x: number, y: number, k: number }) => {
    canvasTransformRef.current = transform
    localStorage.setItem(`workflow-canvas-transform-${workflowName}`, JSON.stringify(transform))
  }, [workflowName])
  
  // Grid update function ref ที่จะใช้ระหว่าง useEffects
  const gridUpdateRef = useRef<(() => void) | null>(null) // Ref to avoid useEffect dependency
  
  // WebSocket status
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')

  // Enhanced node type definitions
  const getNodeDefinition = useCallback((type: string) => {
    const definitions: Record<string, {inputs: NodePort[], outputs: NodePort[], defaultConfig?: any}> = {
      http: {
        inputs: [
          { id: 'trigger', type: 'input', dataType: 'any', label: 'Trigger' }
        ],
        outputs: [
          { id: 'response', type: 'output', dataType: 'object', label: 'Response' },
          { id: 'status', type: 'output', dataType: 'number', label: 'Status' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { method: 'GET', url: '', timeout: 30000 }
      },
      transform: {
        inputs: [
          { id: 'input', type: 'input', dataType: 'any', label: 'Input', required: true }
        ],
        outputs: [
          { id: 'output', type: 'output', dataType: 'any', label: 'Output' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { language: 'javascript', script: 'return input;' }
      },
      conditional: {
        inputs: [
          { id: 'input', type: 'input', dataType: 'any', label: 'Input', required: true }
        ],
        outputs: [
          { id: 'true', type: 'output', dataType: 'any', label: 'True' },
          { id: 'false', type: 'output', dataType: 'any', label: 'False' }
        ],
        defaultConfig: { operator: 'equals', value: '' }
      },
      database: {
        inputs: [
          { id: 'query', type: 'input', dataType: 'string', label: 'Query', required: true },
          { id: 'params', type: 'input', dataType: 'object', label: 'Parameters' }
        ],
        outputs: [
          { id: 'results', type: 'output', dataType: 'array', label: 'Results' },
          { id: 'count', type: 'output', dataType: 'number', label: 'Count' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { connectionString: '', timeout: 30000 }
      },
      ai: {
        inputs: [
          { id: 'prompt', type: 'input', dataType: 'string', label: 'Prompt', required: true },
          { id: 'context', type: 'input', dataType: 'any', label: 'Context' },
          { id: 'history', type: 'input', dataType: 'array', label: 'History' }
        ],
        outputs: [
          { id: 'response', type: 'output', dataType: 'string', label: 'Response' },
          { id: 'tokens', type: 'output', dataType: 'object', label: 'Tokens' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 }
      },
      email: {
        inputs: [
          { id: 'to', type: 'input', dataType: 'string', label: 'To', required: true },
          { id: 'subject', type: 'input', dataType: 'string', label: 'Subject', required: true },
          { id: 'body', type: 'input', dataType: 'string', label: 'Body', required: true }
        ],
        outputs: [
          { id: 'status', type: 'output', dataType: 'string', label: 'Status' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { provider: 'smtp', host: '', port: 587 }
      },
      slack: {
        inputs: [
          { id: 'channel', type: 'input', dataType: 'string', label: 'Channel', required: true },
          { id: 'message', type: 'input', dataType: 'string', label: 'Message', required: true }
        ],
        outputs: [
          { id: 'status', type: 'output', dataType: 'string', label: 'Status' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { token: '', channel: '#general' }
      },
      webhook: {
        inputs: [
          { id: 'payload', type: 'input', dataType: 'object', label: 'Payload', required: true }
        ],
        outputs: [
          { id: 'response', type: 'output', dataType: 'object', label: 'Response' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { url: '', method: 'POST' }
      },
      schedule: {
        inputs: [],
        outputs: [
          { id: 'trigger', type: 'output', dataType: 'object', label: 'Trigger' }
        ],
        defaultConfig: { cron: '0 9 * * *', timezone: 'UTC' }
      },
      loop: {
        inputs: [
          { id: 'items', type: 'input', dataType: 'array', label: 'Items', required: true }
        ],
        outputs: [
          { id: 'item', type: 'output', dataType: 'any', label: 'Current Item' },
          { id: 'index', type: 'output', dataType: 'number', label: 'Index' },
          { id: 'done', type: 'output', dataType: 'boolean', label: 'Done' }
        ],
        defaultConfig: { batchSize: 1, parallel: false }
      },
      parallel: {
        inputs: [
          { id: 'input1', type: 'input', dataType: 'any', label: 'Input 1' },
          { id: 'input2', type: 'input', dataType: 'any', label: 'Input 2' },
          { id: 'input3', type: 'input', dataType: 'any', label: 'Input 3' }
        ],
        outputs: [
          { id: 'output', type: 'output', dataType: 'array', label: 'Combined Output' }
        ],
        defaultConfig: { waitForAll: true, timeout: 60000 }
      },
      subworkflow: {
        inputs: [
          { id: 'input', type: 'input', dataType: 'any', label: 'Input', required: true },
          { id: 'params', type: 'input', dataType: 'object', label: 'Parameters' }
        ],
        outputs: [
          { id: 'output', type: 'output', dataType: 'any', label: 'Output' },
          { id: 'status', type: 'output', dataType: 'string', label: 'Status' },
          { id: 'error', type: 'output', dataType: 'error', label: 'Error' }
        ],
        defaultConfig: { workflowId: '', async: false, timeout: 300000 }
      }
    }
    
    return definitions[type] || { 
      inputs: [{ id: 'input', type: 'input', dataType: 'any', label: 'Input' }], 
      outputs: [{ id: 'output', type: 'output', dataType: 'any', label: 'Output' }],
      defaultConfig: {} 
    }
  }, [])

  // Color schemes
  const getNodeColor = useCallback((type: string, status?: string): string => {
    if (status === 'running') return '#FFA726'
    if (status === 'completed') return '#66BB6A'
    if (status === 'error') return '#EF5350'
    if (status === 'warning') return '#FFCA28'
    
    return NodeTypes[type as keyof typeof NodeTypes]?.color || '#757575'
  }, [])

  const getPortColor = useCallback((dataType: string): string => {
    const colors: Record<string, string> = {
      any: '#9E9E9E',
      string: '#4CAF50',
      number: '#2196F3',
      boolean: '#FF9800',
      object: '#9C27B0',
      array: '#00BCD4',
      error: '#F44336'
    }
    return colors[dataType] || '#9E9E9E'
  }, [])

  const getNodeIcon = useCallback((type: string): string => {
    return NodeTypes[type as keyof typeof NodeTypes]?.icon || '📌'
  }, [])

  // Helper functions
  const getNodeHeight = useCallback((node: WorkflowNode): number => {
    const portCount = Math.max(node.inputs.length, node.outputs.length)
    return Math.max(NODE_MIN_HEIGHT, portCount * 30 + 60)
  }, [])

  // 🚀 MULTI-SELECT UTILITIES
  const isNodeSelected = useCallback((nodeId: string) => {
    return selectedNodes.has(nodeId) || selectedNode?.id === nodeId
  }, [selectedNodes, selectedNode])

  const toggleNodeSelection = useCallback((nodeId: string, ctrlKey: boolean = false) => {
    if (ctrlKey || isMultiSelectMode) {
      setSelectedNodes(prev => {
        const newSet = new Set(prev)
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId)
        } else {
          newSet.add(nodeId)
        }
        return newSet
      })
      // Keep selectedNode for backwards compatibility
      const node = nodes.find(n => n.id === nodeId)
      if (node && !selectedNodes.has(nodeId)) {
        setSelectedNode(node)
      }
    } else {
      // Single select mode
      setSelectedNodes(new Set([nodeId]))
      setSelectedNode(nodes.find(n => n.id === nodeId) || null)
    }
  }, [isMultiSelectMode, selectedNodes, nodes])

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set())
    setSelectedNode(null)
    setSelectedConnection(null)
  }, [])

  const selectNodesInArea = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    const minX = Math.min(startX, endX)
    const maxX = Math.max(startX, endX)
    const minY = Math.min(startY, endY)
    const maxY = Math.max(startY, endY)

    const nodesInArea = nodes.filter(node => {
      return node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
    })

    const nodeIds = new Set(nodesInArea.map(n => n.id))
    setSelectedNodes(nodeIds)
    
    if (nodesInArea.length > 0) {
      setSelectedNode(nodesInArea[0])
    }
  }, [nodes])

  // 🚀 GROUP DRAG UTILITIES
  const getSelectedNodesList = useCallback(() => {
    return nodes.filter(node => isNodeSelected(node.id))
  }, [nodes, isNodeSelected])

  const calculateGroupDragOffsets = useCallback((primaryNodeId: string, _startX: number, _startY: number) => {
    const offsets = new Map<string, {x: number, y: number}>()
    const primaryNode = nodes.find(n => n.id === primaryNodeId)
    
    if (!primaryNode) return offsets

    getSelectedNodesList().forEach(node => {
      if (node.id !== primaryNodeId) {
        offsets.set(node.id, {
          x: node.x - primaryNode.x,
          y: node.y - primaryNode.y
        })
      }
    })

    return offsets
  }, [nodes, getSelectedNodesList])

  const updateGroupPositions = useCallback((primaryNodeId: string, newX: number, newY: number, offsets: Map<string, {x: number, y: number}>) => {
    setNodes(prev => prev.map(node => {
      if (node.id === primaryNodeId) {
        return { ...node, x: newX, y: newY }
      } else if (isNodeSelected(node.id) && offsets.has(node.id)) {
        const offset = offsets.get(node.id)!
        return { ...node, x: newX + offset.x, y: newY + offset.y }
      }
      return node
    }))
  }, [isNodeSelected])


  // Event handlers for port interactions
  // Removed these functions from component level to avoid infinite useEffect loop
  // They are now defined inside the D3 useEffect

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Cancel connection if clicking on empty canvas
    if (isConnecting) {
      setIsConnecting(false)
      setConnectionStart(null)
      setConnectionPreview(null)
      return
    }

    // Clear selection if not holding Ctrl/Cmd
    const ctrlKey = event.ctrlKey || event.metaKey
    if (!ctrlKey && !isSelecting) {
      clearSelection()
    }
    
    setShowNodeEditor(false) // Close node editor panel when clicking on canvas
  }, [isConnecting, isSelecting, clearSelection])

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleCanvasDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleNodeClick = useCallback((event: any, nodeData: WorkflowNode) => {
    // Check for Ctrl/Cmd key for multi-select
    const ctrlKey = event.sourceEvent?.ctrlKey || event.sourceEvent?.metaKey || false
    
    // Use multi-select logic
    toggleNodeSelection(nodeData.id, ctrlKey)
    setSelectedConnection(null)
    setShowNodeEditor(false) // Hide panel on single click
  }, [toggleNodeSelection])

  const handleNodeDoubleClick = useCallback((_event: any, nodeData: WorkflowNode) => {
    // Double click always selects single node and opens editor
    setSelectedNodes(new Set([nodeData.id]))
    setSelectedNode(nodeData)
    setSelectedConnection(null)
    setShowNodeEditor(true) // Show panel on double click
    console.log('Double-clicked node:', nodeData.label)
  }, [])

  // Node operations
  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    const definition = getNodeDefinition(type)
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      label: NodeTypes[type as keyof typeof NodeTypes]?.label || 'New Node',
      x: position?.x || 300 + Math.random() * 200,
      y: position?.y || 200 + Math.random() * 200,
      config: definition.defaultConfig || {},
      inputs: definition.inputs,
      outputs: definition.outputs,
      status: 'idle'
    }
    setNodes(prev => [...prev, newNode])
  }, [getNodeDefinition])

  const handleCanvasDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    
    const nodeType = event.dataTransfer.getData('application/node-type')
    if (nodeType && svgRef.current && containerRef.current) {
      // ใช้ SVG element เป็น reference เหมือนกับ handleDrop
      const rect = svgRef.current.getBoundingClientRect()
      const clientX = event.clientX - rect.left
      const clientY = event.clientY - rect.top
      
      // Apply inverse transform to get correct position in canvas coordinate system
      const transform = d3.zoomTransform(svgRef.current)
      const [x, y] = transform.invert([clientX, clientY])
      
      addNode(nodeType, { x, y })
    }
  }, [addNode])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setConnections(prev => prev.filter(c => 
      c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    ))
    setSelectedNode(null)
  }, [])

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId))
  }, [])

  // Workflow operations
  const saveWorkflow = useCallback(async () => {
    const workflow = {
      name: workflowName,
      definition: {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: [n.x, n.y],
          parameters: n.config
        })),
        edges: connections.map(c => ({
          id: c.id,
          source: c.sourceNodeId,
          target: c.targetNodeId,
          sourceHandle: c.sourcePortId,
          targetHandle: c.targetPortId
        }))
      }
    }
    
    try {
      // await WorkflowService.create(workflow)
      console.log('Workflow saved:', workflow)
      alert('Workflow saved successfully!')
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow')
    }
  }, [workflowName, nodes, connections])

  const executeWorkflow = useCallback(async () => {
    if (nodes.length === 0) {
      alert('Please add nodes to the workflow before executing')
      return
    }

    // Reset node states
    setNodes(prev => prev.map(n => ({ ...n, status: 'idle' })))
    setExecutionState({ 
      status: 'running', 
      completedNodes: [], 
      nodeData: {},
      errors: {},
      logs: []
    })
    
    // Simulate execution with visual feedback
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      setTimeout(() => {
        setNodes(prev => prev.map(n => 
          n.id === node.id ? { ...n, status: 'running' } : n
        ))
        
        setTimeout(() => {
          setNodes(prev => prev.map(n => 
            n.id === node.id ? { ...n, status: 'completed' } : n
          ))
        }, 1000)
      }, i * 1500)
    }
    
    setTimeout(() => {
      setExecutionState(prev => ({ ...prev, status: 'completed' }))
    }, nodes.length * 1500 + 1000)
  }, [nodes])

  // Export workflow
  const exportWorkflow = useCallback(() => {
    const workflow = {
      name: workflowName,
      nodes,
      connections
    }
    const dataStr = JSON.stringify(workflow, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }, [workflowName, nodes, connections])

  // Import workflow
  const importWorkflow = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target?.result as string)
        setWorkflowName(workflow.name || 'Imported Workflow')
        setNodes(workflow.nodes || [])
        setConnections(workflow.connections || [])
      } catch (err) {
        console.error('Import error:', err)
        alert('Invalid workflow file')
      }
    }
    reader.readAsText(file)
  }, [])

  // Handle drop for node palette
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData('nodeType')
    if (nodeType && containerRef.current && svgRef.current) {
      // ใช้ SVG element โดยตรงสำหรับการคำนวณที่แม่นยำ
      const rect = svgRef.current.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top
      
      // Apply inverse transform to get correct position in canvas coordinate system
      const transform = d3.zoomTransform(svgRef.current)
      const [x, y] = transform.invert([clientX, clientY])
      
      addNode(nodeType, { x, y })
    }
  }, [addNode])

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const currentTransform = d3.zoomTransform(svg.node() as any)
    const newScale = Math.min(currentTransform.k * 1.2, 3)
    
    svg.transition().duration(200).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.translate(currentTransform.x, currentTransform.y).scale(newScale)
    )
  }, [])

  const zoomOut = useCallback(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const currentTransform = d3.zoomTransform(svg.node() as any)
    const newScale = Math.max(currentTransform.k / 1.2, 0.2)
    
    svg.transition().duration(200).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.translate(currentTransform.x, currentTransform.y).scale(newScale)
    )
  }, [])

  const fitToScreen = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return
    
    const svg = d3.select(svgRef.current)
    const bounds = {
      minX: Math.min(...nodes.map(n => n.x)) - 100,
      minY: Math.min(...nodes.map(n => n.y)) - 100,
      maxX: Math.max(...nodes.map(n => n.x)) + 100,
      maxY: Math.max(...nodes.map(n => n.y)) + 100
    }
    
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY
    
    const scale = Math.min(width / boundsWidth, height / boundsHeight) * 0.9
    const translateX = width / 2 - (bounds.minX + boundsWidth / 2) * scale
    const translateY = height / 2 - (bounds.minY + boundsHeight / 2) * scale
    
    svg.transition().duration(500).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    )
  }, [nodes])

  // Reset canvas to center (0,0) position
  const resetCanvasPosition = useCallback(() => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    const transform = d3.zoomIdentity.translate(0, 0).scale(1)
    
    // Update ref และ localStorage
    saveCanvasTransform({ x: 0, y: 0, k: 1 })
    
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      transform
    )
  }, [saveCanvasTransform])

  // WebSocket integration
  useEffect(() => {
    // Mock WebSocket status update
    const interval = setInterval(() => {
      setWsStatus('disconnected')
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // D3 Canvas rendering
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    svg.selectAll("*").remove()

    // Add definitions for patterns and markers
    const defs = svg.append("defs")
    
    // Background rect
    svg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "#fcfcfc")
      .attr("class", "svg-canvas-background")

    // Arrow marker - ขนาดใหญ่และสวยงาม
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("markerWidth", 14)
      .attr("markerHeight", 14)
      .attr("refX", 13)   // ตำแหน่งลูกศรบนเส้น - ปรับใหม่เพื่อการหมุนที่แม่นยำ
      .attr("refY", 5)    // จุดศูนย์กลาง
      .attr("orient", "auto-start-reverse") // หมุนตามทิศทางเส้นอัตโนมัติแบบแม่นยำ
      .attr("markerUnits", "userSpaceOnUse") // ขนาดคงที่ไม่ตามความหนาเส้น
      .append("polygon")
      .attr("points", "0,0 13,5 0,10") // รูปสามเหลี่ยมใหญ่และสวยงาม
      .attr("fill", "#666")
      .attr("stroke", "none")

    // Arrow marker สำหรับ selected connection - ขนาดใหญ่และโดดเด่น
    defs.append("marker")
      .attr("id", "arrowhead-selected")
      .attr("markerWidth", 14)
      .attr("markerHeight", 14)
      .attr("refX", 13)
      .attr("refY", 5)
      .attr("orient", "auto-start-reverse")
      .attr("markerUnits", "userSpaceOnUse")
      .append("polygon")
      .attr("points", "0,0 13,5 0,10")
      .attr("fill", "#2196F3")
      .attr("stroke", "none")

    // Arrow marker สำหรับ hover state - ขนาดใหญ่สุดและโดดเด่น
    defs.append("marker")
      .attr("id", "arrowhead-hover")
      .attr("markerWidth", 18)
      .attr("markerHeight", 18)
      .attr("refX", 15)
      .attr("refY", 6)
      .attr("orient", "auto-start-reverse")
      .attr("markerUnits", "userSpaceOnUse")
      .append("polygon")
      .attr("points", "0,0 15,6 0,12")
      .attr("fill", "#1976D2")
      .attr("stroke", "none")

    // Main container with zoom/pan
    const g = svg.append("g")

    // 🚀 LAYER HIERARCHY: สร้าง layers แยกชั้นกันชัดเจน เพื่อป้องกัน grid ทับ nodes
    const gridLayer = g.append("g").attr("class", "grid-layer")
    const connectionLayer = g.append("g").attr("class", "connection-layer") 
    const nodeLayer = g.append("g").attr("class", "node-layer")
    const uiLayer = g.append("g").attr("class", "ui-layer") // สำหรับ selection box, etc.

    // 🚀 DYNAMIC GRID: Create grid that moves with canvas transform
    let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
    let gridUpdateTimeout: NodeJS.Timeout | null = null
    
    const createGrid = () => {
      if (!showGrid) {
        if (gridGroup) {
          gridGroup.remove()
          gridGroup = null
        }
        return
      }
      
      // Remove existing grid
      if (gridGroup) gridGroup.remove()
      
      // 🚀 Create grid ใน gridLayer (ชั้นล่างสุด) แทน main g
      gridGroup = gridLayer.append("g")
        .attr("class", "grid-group")
        .style("pointer-events", "none") // Grid ไม่รับ mouse events
      
      // Get current viewport size and transform
      const svgElement = svgRef.current
      if (!svgElement) return
      
      const rect = svgElement.getBoundingClientRect()
      const currentTransform = d3.zoomTransform(svgElement)
      
      // Calculate visible area in canvas coordinates  
      const scale = currentTransform.k
      const leftBound = -currentTransform.x / scale - 500
      const rightBound = (rect.width - currentTransform.x) / scale + 500
      const topBound = -currentTransform.y / scale - 500
      const bottomBound = (rect.height - currentTransform.y) / scale + 500
      
      // Calculate stroke width and opacity based on zoom
      const strokeWidth = Math.max(0.5, 1 / scale)
      const opacity = Math.min(1, Math.max(0.1, scale * 0.6 + 0.2))
      
      // Skip grid if too zoomed out to avoid performance issues
      if (scale < 0.3) return
      
      // Create vertical grid lines
      const startX = Math.floor(leftBound / GRID_SIZE) * GRID_SIZE
      const endX = Math.ceil(rightBound / GRID_SIZE) * GRID_SIZE
      
      for (let x = startX; x <= endX; x += GRID_SIZE) {
        gridGroup.append("line")
          .attr("x1", x)
          .attr("y1", topBound)
          .attr("x2", x)
          .attr("y2", bottomBound)
          .attr("stroke", "#f5f5f5")
          .attr("stroke-width", strokeWidth)
          .attr("opacity", opacity)
      }
      
      // Create horizontal grid lines
      const startY = Math.floor(topBound / GRID_SIZE) * GRID_SIZE
      const endY = Math.ceil(bottomBound / GRID_SIZE) * GRID_SIZE
      
      for (let y = startY; y <= endY; y += GRID_SIZE) {
        gridGroup.append("line")
          .attr("x1", leftBound)
          .attr("y1", y)
          .attr("x2", rightBound)
          .attr("y2", y)
          .attr("stroke", "#f5f5f5")
          .attr("stroke-width", strokeWidth)
          .attr("opacity", opacity)
      }
    }
    
    // Store createGrid function ใน ref เพื่อให้ useEffect อื่นเรียกใช้ได้
    gridUpdateRef.current = createGrid
    
    // Throttled grid update function
    const updateGridThrottled = () => {
      if (gridUpdateTimeout) {
        clearTimeout(gridUpdateTimeout)
      }
      gridUpdateTimeout = setTimeout(() => {
        createGrid()
        gridUpdateTimeout = null
      }, 16) // ~60fps
    }

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        const { transform } = event
        // Update the visual transform
        g.attr("transform", transform.toString())
        
        // 🚀 บันทึก canvas transform state เมื่อมีการเปลี่ยนแปลง
        saveCanvasTransform({
          x: transform.x,
          y: transform.y,
          k: transform.k
        })
        
        // Update zoom level for display (throttled to avoid too many updates)
        zoomLevelRef.current = transform.k
        if (Math.abs(transform.k - zoomLevel) > 0.05) {
          setZoomLevel(transform.k)
        }
        
        // 🚀 Update grid on zoom/pan changes with throttling
        updateGridThrottled()
      })

    svg.call(zoom)
    
    // 🚀 Set initial zoom transform ใช้ saved canvas transform แทน default
    const initialTransform = d3.zoomIdentity
      .translate(canvasTransformRef.current.x, canvasTransformRef.current.y)
      .scale(canvasTransformRef.current.k)
    svg.call(zoom.transform, initialTransform)
    
    // 🚀 Create initial grid หลังจากสร้าง layers และ setup zoom แล้ว
    createGrid()

    // Generate connection path function - ปรับปรุงให้ลูกศรหมุนตามทิศทางได้ดี
    const generateConnectionPathLocal = (connection: Connection): string => {
      const sourceNode = nodes.find(n => n.id === connection.sourceNodeId)
      const targetNode = nodes.find(n => n.id === connection.targetNodeId)
      
      if (!sourceNode || !targetNode) return ""

      const sourcePort = sourceNode.outputs.find(p => p.id === connection.sourcePortId)
      const targetPort = targetNode.inputs.find(p => p.id === connection.targetPortId)
      
      if (!sourcePort || !targetPort) return ""

      const sourceIndex = sourceNode.outputs.indexOf(sourcePort)
      const targetIndex = targetNode.inputs.indexOf(targetPort)

      // ✅ คำนวณตำแหน่งพอร์ตที่แม่นยำ
      const x1 = sourceNode.x + NODE_WIDTH/2
      const y1 = sourceNode.y + 40 + sourceIndex * 30
      const x2 = targetNode.x - NODE_WIDTH/2
      const y2 = targetNode.y + 40 + targetIndex * 30

      const dx = x2 - x1
      const dy = y2 - y1
      
      // ✅ ปรับ control point ให้ลูกศรหมุนตามทิศทางปลายเส้นได้ถูกต้องและชัดเจนมากขึ้น
      const controlOffset = Math.max(Math.abs(dx) / 2, 80) // เพิ่ม offset เพื่อทิศทางที่ชัดเจน
      
      // ✅ Control points ที่ให้ลูกศรหมุนได้ถูกต้อง - ปรับเพื่อการหมุนที่แม่นยำขึ้น
      const cp1x = x1 + controlOffset
      const cp1y = y1 + dy * 0.05  // ลด curve ตามแนว Y เพื่อให้ทิศทางชัดเจน
      const cp2x = x2 - controlOffset  
      const cp2y = y2 - dy * 0.05  // ให้ลูกศรมีทิศทางที่แม่นยำมากขึ้น

      return `M ${x1} ${y1} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x2} ${y2}`
    }

    // Draw connections ใน connectionLayer
    const connectionPaths = connectionLayer.selectAll(".connection")
      .data(connections)
      .enter()
      .append("g")
      .attr("class", "connection")

    connectionPaths.append("path")
      .attr("d", d => generateConnectionPathLocal(d))
      .attr("stroke", "#666")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)")
      .attr("class", "connection-path")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation()
        setSelectedConnection(d)
        setSelectedNode(null)
      })
      .on("mouseenter", function(_event, _d) {
        // ✅ Hover effect with different arrowhead
        d3.select(this)
          .attr("stroke", "#1976D2")
          .attr("stroke-width", 3)
          .attr("marker-end", "url(#arrowhead-hover)")
      })
      .on("mouseleave", function(_event, d) {
        // ✅ Return to normal or selected state
        const isSelected = selectedConnection?.id === d.id
        d3.select(this)
          .attr("stroke", isSelected ? "#2196F3" : "#666")
          .attr("stroke-width", isSelected ? 3 : 2)
          .attr("marker-end", isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)")
      })

    // Draw connection preview - ปรับปรุงให้ consistent กับ connection จริง
    if (isConnecting && connectionStart && connectionPreview) {
      const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
      if (sourceNode) {
        const sourcePort = sourceNode.outputs.find(p => p.id === connectionStart.portId)
        if (sourcePort) {
          const sourceIndex = sourceNode.outputs.indexOf(sourcePort)
          const startX = sourceNode.x + NODE_WIDTH/2
          const startY = sourceNode.y + 40 + sourceIndex * 30
          
          // ✅ ใช้การคำนวณแบบเดียวกับ generateConnectionPathLocal
          const dx = connectionPreview.x - startX
          const dy = connectionPreview.y - startY
          const controlOffset = Math.max(Math.abs(dx) / 2.5, 60)
          
          const cp1x = startX + controlOffset
          const cp1y = startY + dy * 0.1
          const cp2x = connectionPreview.x - controlOffset  
          const cp2y = connectionPreview.y - dy * 0.1
          
          const previewPath = `M ${startX} ${startY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${connectionPreview.x} ${connectionPreview.y}`
          
          g.append("path")
            .attr("class", "connection-preview")
            .attr("d", previewPath)
            .attr("stroke", "#2196F3")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("fill", "none")
            .attr("marker-end", "url(#arrowhead)") // ✅ เพิ่ม arrowhead สำหรับ preview
            .attr("pointer-events", "none")
            .style("opacity", 0.7)
        }
      }
    }

    // Draw nodes
    // Create drag handlers inside useEffect to avoid infinite loop
    let draggedElement: d3.Selection<any, any, any, any> | null = null
    
    // Port event handlers defined here to avoid useEffect dependencies
    const handlePortClick = (event: any, portData: any) => {
      event.stopPropagation()
      console.log('Port clicked:', portData)
      
      if (isConnecting && connectionStart) {
        // Complete connection - only allow output -> input connections
        if (connectionStart.nodeId !== portData.nodeId) {
          // Find the source and target based on port types
          let sourceNode, sourcePort, targetNode, targetPort
          
          if (connectionStart.type === 'output' && portData.type === 'input') {
            // Valid connection: output -> input
            sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
            sourcePort = sourceNode?.outputs.find(p => p.id === connectionStart.portId)
            targetNode = nodes.find(n => n.id === portData.nodeId)
            targetPort = targetNode?.inputs.find(p => p.id === portData.id)
          } else if (connectionStart.type === 'input' && portData.type === 'output') {
            // Reverse connection: input -> output (swap for consistency)
            sourceNode = nodes.find(n => n.id === portData.nodeId)
            sourcePort = sourceNode?.outputs.find(p => p.id === portData.id)
            targetNode = nodes.find(n => n.id === connectionStart.nodeId)
            targetPort = targetNode?.inputs.find(p => p.id === connectionStart.portId)
          }
          
          if (sourceNode && sourcePort && targetNode && targetPort) {
            // Check if connection already exists
            const existingConnection = connections.find(c => 
              c.sourceNodeId === sourceNode.id && 
              c.sourcePortId === sourcePort.id && 
              c.targetNodeId === targetNode.id && 
              c.targetPortId === targetPort.id
            )
            
            if (!existingConnection) {
              const newConnection: Connection = {
                id: `conn-${Date.now()}`,
                sourceNodeId: sourceNode.id,
                sourcePortId: sourcePort.id,
                targetNodeId: targetNode.id,
                targetPortId: targetPort.id,
                validated: true
              }

              setConnections(prev => [...prev, newConnection])
              console.log('Connection created:', newConnection)
            } else {
              console.log('Connection already exists')
            }
          }
        }
        
        setIsConnecting(false)
        setConnectionStart(null)
      } else {
        // Start connection
        setIsConnecting(true)
        setConnectionStart({
          nodeId: portData.nodeId,
          portId: portData.id,
          type: portData.type
        })
        console.log('Connection started from:', portData)
      }
    }

    const handlePortMouseDown = (event: any, portData: any) => {
      event.stopPropagation()
      event.preventDefault()
      
      // Only start connection on output ports for better UX
      if (portData.type === 'output') {
        setIsConnecting(true)
        setConnectionStart({
          nodeId: portData.nodeId,
          portId: portData.id,
          type: portData.type
        })
        console.log('Connection started with mouse down:', portData)
      }
    }

    const handlePortMouseUp = (event: any, portData: any) => {
      event.stopPropagation()
      
      if (isConnecting && connectionStart && portData.type === 'input') {
        // Complete connection on input port
        if (connectionStart.nodeId !== portData.nodeId) {
          const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
          const sourcePort = sourceNode?.outputs.find(p => p.id === connectionStart.portId)
          const targetNode = nodes.find(n => n.id === portData.nodeId)
          const targetPort = targetNode?.inputs.find(p => p.id === portData.id)
          
          if (sourceNode && sourcePort && targetNode && targetPort) {
            // Check if connection already exists
            const existingConnection = connections.find(c => 
              c.sourceNodeId === sourceNode.id && 
              c.sourcePortId === sourcePort.id && 
              c.targetNodeId === targetNode.id && 
              c.targetPortId === targetPort.id
            )
            
            if (!existingConnection) {
              const newConnection: Connection = {
                id: `conn-${Date.now()}`,
                sourceNodeId: sourceNode.id,
                sourcePortId: sourcePort.id,
                targetNodeId: targetNode.id,
                targetPortId: targetPort.id,
                validated: true
              }

              setConnections(prev => [...prev, newConnection])
              console.log('Connection completed with mouse up:', newConnection)
            }
          }
        }
        
        setIsConnecting(false)
        setConnectionStart(null)
        setConnectionPreview(null)
      }
    }
    
    function dragStarted(this: any, event: any, d: WorkflowNode) {
      // Cancel any ongoing connection when starting to drag
      if (isConnecting) {
        setIsConnecting(false)
        setConnectionStart(null)
        setConnectionPreview(null)
      }
      
      draggedElement = d3.select(this)
      
      // ✅ Use SVG as reference for accurate coordinate calculation
      const svgElement = svgRef.current
      if (!svgElement) return
      
      // Get current mouse position - try direct event first, fallback to sourceEvent
      const sourceEvent = event.sourceEvent || event
      const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement)
      
      // Apply current transform to get position in canvas coordinate system
      const transform = d3.zoomTransform(svgElement)
      const [canvasX, canvasY] = transform.invert([mouseX, mouseY])

      // 🚀 GROUP DRAG: Check if this node is part of a selection
      const isPartOfSelection = isNodeSelected(d.id)
      const selectedNodesList = getSelectedNodesList()
      
      if (isPartOfSelection && selectedNodesList.length > 1) {
        // GROUP DRAG: Setup for dragging multiple nodes
        setIsGroupDragging(true)
        
        // Calculate offsets for all selected nodes relative to the dragged node
        const offsets = calculateGroupDragOffsets(d.id, canvasX, canvasY)
        setDragOffset(offsets)
        
        // Store initial positions for ALL selected nodes
        selectedNodesList.forEach(node => {
          node.dragStartX = canvasX
          node.dragStartY = canvasY
          node.initialX = node.x
          node.initialY = node.y
        })
        
        console.log('🟢 Group Drag Start:', {
          primaryNode: d.id,
          selectedCount: selectedNodesList.length,
          canvasPos: [canvasX, canvasY],
          transform: transform.toString()
        })
      } else {
        // SINGLE DRAG: Normal single node drag
        setIsGroupDragging(false)
        
        // Store start positions for delta calculation
        d.dragStartX = canvasX
        d.dragStartY = canvasY
        d.initialX = d.x
        d.initialY = d.y
        
        console.log('🟢 Single Drag Start:', {
          nodeId: d.id,
          canvasPos: [canvasX, canvasY],
          nodePos: [d.x, d.y],
          transform: transform.toString()
        })
      }
      
      // Bring the dragged node to the front and add dragging class
      draggedElement
        .raise()
        .classed('dragging', true)
        .style('cursor', 'grabbing')
      
      // Update selected node for consistency
      setSelectedNode(d)
    }
    
    function dragged(this: any, event: any, d: WorkflowNode) {
      if (!draggedElement || d.dragStartX === undefined || d.dragStartY === undefined) return
      if (d.initialX === undefined || d.initialY === undefined) return
      
      // ✅ Use same SVG reference for consistent coordinate calculation
      const svgElement = svgRef.current
      if (!svgElement) return
      
      // Get current mouse position - try direct event first, fallback to sourceEvent
      const sourceEvent = event.sourceEvent || event
      const [mouseX, mouseY] = d3.pointer(sourceEvent, svgElement)
      
      // Apply current transform to get position in canvas coordinate system
      const transform = d3.zoomTransform(svgElement)
      const [currentCanvasX, currentCanvasY] = transform.invert([mouseX, mouseY])
      
      // ✅ Calculate delta from drag start (both in canvas coordinates)
      const deltaX = currentCanvasX - d.dragStartX
      const deltaY = currentCanvasY - d.dragStartY
      
      // ✅ Apply delta to initial position
      const newX = d.initialX + deltaX
      const newY = d.initialY + deltaY
      
      if (isGroupDragging && dragOffset.size > 0) {
        // 🚀 GROUP DRAG: Update all selected nodes
        updateGroupPositions(d.id, newX, newY, dragOffset)
        
        // Update visual positions for all selected nodes
        nodeLayer.selectAll('.node')
          .filter((nodeData: any) => isNodeSelected(nodeData.id))
          .attr("transform", (nodeData: any) => `translate(${nodeData.x}, ${nodeData.y})`)
        
        // Debug logging (throttled)
        if (Math.random() < 0.05) { // Log only 5% of group drag events
          console.log('🔄 Group Dragging:', {
            primaryNode: d.id,
            delta: [deltaX, deltaY],
            selectedCount: getSelectedNodesList().length,
            newPosition: [newX, newY]
          })
        }
      } else {
        // 🔄 SINGLE DRAG: Normal single node drag
        d.x = newX
        d.y = newY
        
        // Update visual position immediately
        draggedElement.attr("transform", `translate(${d.x}, ${d.y})`)
        
        // Debug logging (throttled)
        if (Math.random() < 0.1) { // Log only 10% of drag events to avoid spam
          console.log('🔄 Single Dragging:', {
            nodeId: d.id,
            delta: [deltaX, deltaY],
            newNodePos: [d.x, d.y],
            canvasPos: [currentCanvasX, currentCanvasY]
          })
        }
      }
      
      // Update connections in real-time during drag
      const updateConnections = () => {
        connectionLayer.selectAll('.connection path')
          .attr('d', (conn: any) => generateConnectionPathLocal(conn))
      }
      updateConnections()
      
      // ✅ Update React state with throttling for better performance
      requestAnimationFrame(() => {
        if (isGroupDragging) {
          // Group drag state is already updated in updateGroupPositions
          return
        } else {
          const updateNodePosition = () => {
            setNodes(prev => prev.map(n => 
              n.id === d.id ? {...n, x: d.x, y: d.y} : n
            ))
          }
          updateNodePosition()
        }
      })
    }
    
    function dragEnded(this: any, _event: any, d: WorkflowNode) {
      if (!draggedElement) return
      
      if (isGroupDragging && dragOffset.size > 0) {
        // 🚀 GROUP DRAG END: Clean up all selected nodes
        const selectedNodesList = getSelectedNodesList()
        
        selectedNodesList.forEach(node => {
          delete node.dragStartX
          delete node.dragStartY
          delete node.initialX
          delete node.initialY
        })
        
        // Snap to grid if enabled for all selected nodes
        if (showGrid) {
          const snappedNodes = selectedNodesList.map(node => ({
            ...node,
            x: Math.round(node.x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(node.y / GRID_SIZE) * GRID_SIZE
          }))
          
          // Update all nodes at once
          setNodes(prev => prev.map(node => {
            const snapped = snappedNodes.find(s => s.id === node.id)
            return snapped || node
          }))
          
          // Animate all selected nodes to grid positions
          nodeLayer.selectAll('.node')
            .filter((nodeData: any) => isNodeSelected(nodeData.id))
            .transition()
            .duration(200)
            .ease(d3.easeBackOut.overshoot(0.2))
            .attr("transform", (nodeData: any) => {
              const snapped = snappedNodes.find(s => s.id === nodeData.id)
              if (snapped) {
                nodeData.x = snapped.x
                nodeData.y = snapped.y
                return `translate(${snapped.x}, ${snapped.y})`
              }
              return `translate(${nodeData.x}, ${nodeData.y})`
            })
            .on('end', () => {
              // Update connections after grid snap animation
              connectionLayer.selectAll('.connection path')
                .attr('d', (conn: any) => generateConnectionPathLocal(conn))
            })
        }
        
        // Reset group drag state
        setIsGroupDragging(false)
        setDragOffset(new Map())
        
        console.log('🟢 Group Drag End:', {
          selectedCount: selectedNodesList.length,
          snappedToGrid: showGrid
        })
      } else {
        // 🔄 SINGLE DRAG END: Normal cleanup
        delete d.dragStartX
        delete d.dragStartY
        delete d.initialX
        delete d.initialY
        
        let finalX = d.x
        let finalY = d.y
        
        // Snap to grid if enabled
        if (showGrid) {
          finalX = Math.round(d.x / GRID_SIZE) * GRID_SIZE
          finalY = Math.round(d.y / GRID_SIZE) * GRID_SIZE
          
          // Update d3 data immediately
          d.x = finalX
          d.y = finalY
          
          // Animate to grid position
          draggedElement
            .transition()
            .duration(200)
            .ease(d3.easeBackOut.overshoot(0.2))
            .attr("transform", `translate(${finalX}, ${finalY})`)
            .on('end', () => {
              // Update connections after grid snap animation
              connectionLayer.selectAll('.connection path')
                .attr('d', (conn: any) => generateConnectionPathLocal(conn))
            })
        }
        
        // Final state update
        setNodes(prev => prev.map(n => 
          n.id === d.id ? {...n, x: finalX, y: finalY} : n
        ))
        
        console.log('🟢 Single Drag End:', {
          nodeId: d.id,
          finalPosition: [finalX, finalY],
          snappedToGrid: showGrid
        })
      }
      
      // Remove dragging class and reset cursor
      draggedElement
        .classed('dragging', false)
        .style('cursor', 'move')
      
      draggedElement = null
    }
    
    // ✅ ใช้ proper D3 update pattern เพื่อป้องกัน node จาก jump ตำแหน่งเมื่อ zoom
    const nodeSelection = nodeLayer.selectAll(".node")
      .data(nodes, (d: any) => d.id) // ใช้ id เป็น key สำหรับ data binding
    
    // Handle exits (nodes ที่ถูกลบ)
    nodeSelection.exit().remove()
    
    // Handle enters (nodes ใหม่)
    const nodeEnter = nodeSelection.enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .style("cursor", "move")
      .call(d3.drag<any, WorkflowNode>()
        .container(g.node() as any)  // ✅ ใช้ g element เป็น container สำหรับ proper coordinate calculation
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded) as any)
    
    // Merge enters และ updates
    const nodeGroups = nodeEnter.merge(nodeSelection as any)
    
    // ✅ Update positions สำหรับ nodes ทั้งหมด (ใหม่และเก่า) แต่เฉพาะเมื่อ state เปลี่ยนจริงๆ
    // ไม่ update ถ้า node กำลังถูก drag อยู่
    nodeGroups
      .filter(function(_d: WorkflowNode) {
        // ไม่ update node ที่กำลังถูก drag
        return !d3.select(this).classed('dragging')
      })
      .attr("transform", d => `translate(${d.x}, ${d.y})`)

    // Node background - เพิ่มเฉพาะ nodes ใหม่
    nodeEnter.append("rect")
      .attr("class", "node-background")
      .attr("width", NODE_WIDTH)
      .attr("height", d => getNodeHeight(d))
      .attr("x", -NODE_WIDTH/2)
      .attr("y", -20)
      .attr("rx", 12)
      .attr("fill", "#ffffff")
      .on("click", handleNodeClick)
      .on("dblclick", handleNodeDoubleClick)
    
    // Update node background attributes สำหรับ nodes ทั้งหมด
    nodeGroups.select(".node-background")
      .attr("height", d => getNodeHeight(d))
      .attr("stroke", d => getNodeColor(d.type, d.status))
      .attr("stroke-width", d => isNodeSelected(d.id) ? 3 : 2)
      .style("filter", d => {
        if (d.status === 'running') return 'drop-shadow(0 0 8px rgba(255, 167, 38, 0.6))'
        if (isNodeSelected(d.id)) return 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.5))'
        return 'none'
      })

    // Node status indicator - เพิ่มเฉพาะ nodes ใหม่
    nodeEnter.append("circle")
      .attr("class", "node-status")
      .attr("cx", NODE_WIDTH/2 - 15)
      .attr("cy", -15)
      .attr("r", 4)
    
    // Update status indicator สำหรับ nodes ทั้งหมด
    nodeGroups.select(".node-status")
      .attr("fill", d => {
        switch (d.status) {
          case 'running': return '#FFA726'
          case 'completed': return '#66BB6A'
          case 'error': return '#EF5350'
          case 'warning': return '#FFCA28'
          default: return '#9E9E9E'
        }
      })
      .style("display", d => d.status && d.status !== 'idle' ? "block" : "none")

    // Node icon - เพิ่มเฉพาะ nodes ใหม่
    nodeEnter.append("text")
      .attr("class", "node-icon")
      .attr("x", -NODE_WIDTH/2 + 15)
      .attr("y", 5)
      .attr("font-size", "20px")
    
    // Update icon สำหรับ nodes ทั้งหมด
    nodeGroups.select(".node-icon")
      .text(d => getNodeIcon(d.type))

    // Node title - เพิ่มเฉพาะ nodes ใหม่
    nodeEnter.append("text")
      .attr("class", "node-title")
      .attr("x", -NODE_WIDTH/2 + 45)
      .attr("y", -5)
      .attr("font-weight", "600")
      .attr("font-size", "14px")
      .attr("fill", "#333")
    
    // Update title สำหรับ nodes ทั้งหมด
    nodeGroups.select(".node-title")
      .text(d => d.label)

    // Node type - เพิ่มเฉพาะ nodes ใหม่
    nodeEnter.append("text")
      .attr("class", "node-type")
      .attr("x", -NODE_WIDTH/2 + 45)
      .attr("y", 15)
      .attr("font-size", "12px")
      .attr("fill", "#666")
    
    // Update type สำหรับ nodes ทั้งหมด
    nodeGroups.select(".node-type")
      .text(d => d.type)

    // Input ports - เพิ่มเฉพาะ nodes ใหม่
    const inputPortGroups = nodeEnter.selectAll(".input-port")
      .data(d => d.inputs.map(input => ({...input, nodeId: d.id})))
      .enter()
      .append("g")
      .attr("class", "input-port")
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      .on("click", function(event, d) {
        handlePortClick(event, d)
      })
      .on("mousedown", function(event, d) {
        handlePortMouseDown(event, d)
      })
      .on("mouseup", function(event, d) {
        handlePortMouseUp(event, d)
      })

    // Update input port positions สำหรับ nodes ทั้งหมด
    nodeGroups.selectAll(".input-port")
      .data(d => d.inputs.map(input => ({...input, nodeId: d.id})))
      .attr("transform", (_d, i) => `translate(${-NODE_WIDTH/2}, ${40 + i * 30})`)

    // Input port circles - เพิ่มเฉพาะ ports ใหม่
    inputPortGroups.append("circle")
      .attr("r", PORT_RADIUS)
    
    // Update input port circles styles - แยกการ update ออกมาเป็นขั้นตอน
    nodeGroups.each(function(nodeData) {
      const nodeGroup = d3.select(this)
      const inputPorts = nodeGroup.selectAll(".input-port circle")
      
      inputPorts
        .attr("fill", () => getPortColor("any")) // ใช้ default color ก่อน
        .attr("stroke", () => {
          if (isConnecting && connectionStart) {
            if (connectionStart.type === 'output' && nodeData.id !== connectionStart.nodeId) {
              return "#4CAF50"
            }
          }
          return "#333"
        })
        .attr("stroke-width", () => {
          if (isConnecting && connectionStart && connectionStart.type === 'output' && nodeData.id !== connectionStart.nodeId) {
            return 3
          }
          return 2
        })
        .style("filter", () => {
          if (isConnecting && connectionStart && connectionStart.type === 'output' && nodeData.id !== connectionStart.nodeId) {
            return "drop-shadow(0 0 4px rgba(76, 175, 80, 0.6))"
          }
          return "none"
        })
    })

    // Input port text - เพิ่มเฉพาะ ports ใหม่
    inputPortGroups.append("text")
      .attr("x", -15)
      .attr("y", 0)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("font-size", "10px")
      .attr("fill", "#666")
    
    // Update input port text - แยกการ update ออกมาเป็นขั้นตอน
    nodeGroups.each(function(nodeData) {
      const nodeGroup = d3.select(this)
      const inputTexts = nodeGroup.selectAll(".input-port text")
      
      // Update text content based on node inputs
      inputTexts.each(function(_d, i) {
        if (nodeData.inputs && nodeData.inputs[i]) {
          d3.select(this).text(nodeData.inputs[i].label)
        }
      })
    })

    // Output ports - เพิ่มเฉพาะ nodes ใหม่
    const outputPortGroups = nodeEnter.selectAll(".output-port")
      .data(d => d.outputs.map(output => ({...output, nodeId: d.id})))
      .enter()
      .append("g")
      .attr("class", "output-port")
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      .on("click", function(event, d) {
        handlePortClick(event, d)
      })
      .on("mousedown", function(event, d) {
        handlePortMouseDown(event, d)
      })
      .on("mouseup", function(event, d) {
        handlePortMouseUp(event, d)
      })

    // Update output port positions สำหรับ nodes ทั้งหมด
    nodeGroups.selectAll(".output-port")
      .data(d => d.outputs.map(output => ({...output, nodeId: d.id})))
      .attr("transform", (_d, i) => `translate(${NODE_WIDTH/2}, ${40 + i * 30})`)

    // Output port circles - เพิ่มเฉพาะ ports ใหม่
    outputPortGroups.append("circle")
      .attr("r", PORT_RADIUS)
    
    // Update output port circles styles - แยกการ update ออกมาเป็นขั้นตอน
    nodeGroups.each(function(nodeData) {
      const nodeGroup = d3.select(this)
      const outputPorts = nodeGroup.selectAll(".output-port circle")
      
      outputPorts
        .attr("fill", () => getPortColor("any")) // ใช้ default color ก่อน
        .attr("stroke", () => {
          if (isConnecting && connectionStart && connectionStart.nodeId === nodeData.id) {
            return "#2196F3"
          }
          return "#333"
        })
        .attr("stroke-width", () => {
          if (isConnecting && connectionStart && connectionStart.nodeId === nodeData.id) {
            return 3
          }
          return 2
        })
        .style("filter", () => {
          if (isConnecting && connectionStart && connectionStart.nodeId === nodeData.id) {
            return "drop-shadow(0 0 4px rgba(33, 150, 243, 0.6))"
          }
          return "none"
        })
    })

    // Output port text - เพิ่มเฉพาะ ports ใหม่
    outputPortGroups.append("text")
      .attr("x", 15)
      .attr("y", 0)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("fill", "#666")
    
    // Update output port text - แยกการ update ออกมาเป็นขั้นตอน
    nodeGroups.each(function(nodeData) {
      const nodeGroup = d3.select(this)
      const outputTexts = nodeGroup.selectAll(".output-port text")
      
      // Update text content based on node outputs
      outputTexts.each(function(_d, i) {
        if (nodeData.outputs && nodeData.outputs[i]) {
          d3.select(this).text(nodeData.outputs[i].label)
        }
      })
    })

    // Canvas click handler
    svg.on("click", () => {
      if (isConnecting) {
        setIsConnecting(false)
        setConnectionStart(null)
        setConnectionPreview(null)
      } else {
        clearSelection()
        setShowNodeEditor(false) // Close panel when clicking on SVG canvas
      }
    })

    // 🚀 CANVAS SELECTION BOX: Add mouse handlers for drag selection
    let selectionStart: [number, number] | null = null
    let isMouseDown = false
    
    svg.on("mousedown", (event) => {
      const target = event.target
      // Only start selection if clicking on empty canvas (not on nodes)
      if (target.tagName === 'svg' || target.classList.contains('svg-canvas-background')) {
        isMouseDown = true
        // ✅ ใช้ SVG element แทน g.node() เพื่อ coordinates ที่ถูกต้อง
        const svgElement = svgRef.current!
        const [mouseX, mouseY] = d3.pointer(event, svgElement)
        const transform = d3.zoomTransform(svgElement)
        const [x, y] = transform.invert([mouseX, mouseY])
        
        selectionStart = [x, y]
        setIsSelecting(true)
        
        // Clear existing selection if not holding Ctrl/Cmd
        const ctrlKey = event.ctrlKey || event.metaKey
        if (!ctrlKey) {
          clearSelection()
        }
        
        // Create selection box element ใน uiLayer (ชั้นบนสุด)
        uiLayer.append("rect")
          .attr("class", "selection-box")
          .attr("x", x)
          .attr("y", y)
          .attr("width", 0)
          .attr("height", 0)
          .style("fill", "rgba(33, 150, 243, 0.1)")
          .style("stroke", "#2196F3")
          .style("stroke-width", 1)
          .style("stroke-dasharray", "5,5")
      }
    })
    
    svg.on("mouseup", (event) => {
      if (isMouseDown && selectionStart && isSelecting) {
        // ✅ ใช้ SVG element แทน g.node() เพื่อ coordinates ที่ถูกต้อง
        const svgElement = svgRef.current!
        const [mouseX, mouseY] = d3.pointer(event, svgElement)
        const transform = d3.zoomTransform(svgElement)
        const [endX, endY] = transform.invert([mouseX, mouseY])
        const [startX, startY] = selectionStart
        
        const minX = Math.min(startX, endX)
        const maxX = Math.max(startX, endX)
        const minY = Math.min(startY, endY)
        const maxY = Math.max(startY, endY)
        
        // Only select if there's a meaningful drag area
        if (Math.abs(maxX - minX) > 5 && Math.abs(maxY - minY) > 5) {
          selectNodesInArea(minX, maxX, minY, maxY)
        }
        
        // Clean up
        uiLayer.select(".selection-box").remove()
        setIsSelecting(false)
      }
      
      isMouseDown = false
      selectionStart = null
    })

    // Mouse move handler for connection preview and selection box
    svg.on("mousemove", (event) => {
      // Handle connection preview
      if (isConnecting && connectionStart) {
        // ✅ ใช้ SVG element แทน g.node() สำหรับ connection preview
        const svgElement = svgRef.current!
        const [mouseX, mouseY] = d3.pointer(event, svgElement)
        const transform = d3.zoomTransform(svgElement)
        const [x, y] = transform.invert([mouseX, mouseY])
        setConnectionPreview({ x, y })
        return
      }
      
      // Handle selection box
      if (isMouseDown && selectionStart && isSelecting) {
        // ✅ ใช้ SVG element แทน g.node() สำหรับ selection box
        const svgElement = svgRef.current!
        const [mouseX, mouseY] = d3.pointer(event, svgElement)
        const transform = d3.zoomTransform(svgElement)
        const [currentX, currentY] = transform.invert([mouseX, mouseY])
        const [startX, startY] = selectionStart
        
        const minX = Math.min(startX, currentX)
        const minY = Math.min(startY, currentY)
        const width = Math.abs(currentX - startX)
        const height = Math.abs(currentY - startY)
        
        // Update selection box
        uiLayer.select(".selection-box")
          .attr("x", minX)
          .attr("y", minY)
          .attr("width", width)
          .attr("height", height)
      }
    })

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConnecting) {
          setIsConnecting(false)
          setConnectionStart(null)
        } else if (showNodeEditor) {
          setShowNodeEditor(false) // Close node editor panel with Escape
        } else if (selectedNodes.size > 0) {
          clearSelection() // Clear multi-selection with Escape
        }
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedConnection) {
          removeConnection(selectedConnection.id)
          setSelectedConnection(null)
        } else if (selectedNodes.size > 0) {
          // Delete all selected nodes
          const nodeIdsToDelete = Array.from(selectedNodes)
          nodeIdsToDelete.forEach(nodeId => deleteNode(nodeId))
          clearSelection()
        } else if (selectedNode) {
          deleteNode(selectedNode.id)
        }
      }

      // Toggle multi-select mode with Shift
      if (e.key === 'Shift') {
        setIsMultiSelectMode(true)
      }

      // Select all with Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const allNodeIds = new Set(nodes.map(n => n.id))
        setSelectedNodes(allNodeIds)
        if (nodes.length > 0) {
          setSelectedNode(nodes[0])
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsMultiSelectMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }

  }, [nodes, connections, selectedNode, selectedNodes, selectedConnection, showGrid, isConnecting, connectionStart, connectionPreview, clearSelection, removeConnection, deleteNode, toggleNodeSelection, isNodeSelected, getSelectedNodesList, isGroupDragging, dragOffset, updateGroupPositions, calculateGroupDragOffsets, selectNodesInArea])

  // 🚀 Grid toggle effect - update grid when showGrid changes
  useEffect(() => {
    if (!svgRef.current) return
    
    // Find and update grid
    const svg = d3.select(svgRef.current)
    const mainGroup = svg.select('g')
    
    if (mainGroup.empty()) return
    
    // Remove existing grid
    mainGroup.select('.grid-group').remove()
    
    // Recreate grid if enabled
    if (showGrid) {
      const gridGroup = mainGroup.append("g")
        .attr("class", "grid-group")
        .style("pointer-events", "none")
      
      const svgElement = svgRef.current
      const rect = svgElement.getBoundingClientRect()
      const currentTransform = d3.zoomTransform(svgElement)
      
      const scale = currentTransform.k
      const leftBound = -currentTransform.x / scale - 500
      const rightBound = (rect.width - currentTransform.x) / scale + 500
      const topBound = -currentTransform.y / scale - 500
      const bottomBound = (rect.height - currentTransform.y) / scale + 500
      
      const strokeWidth = Math.max(0.5, 1 / scale)
      const opacity = Math.min(1, Math.max(0.1, scale * 0.6 + 0.2))
      
      if (scale >= 0.3) {
        // Create vertical grid lines
        const startX = Math.floor(leftBound / GRID_SIZE) * GRID_SIZE
        const endX = Math.ceil(rightBound / GRID_SIZE) * GRID_SIZE
        
        for (let x = startX; x <= endX; x += GRID_SIZE) {
          gridGroup.append("line")
            .attr("x1", x)
            .attr("y1", topBound)
            .attr("x2", x)
            .attr("y2", bottomBound)
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", strokeWidth)
            .attr("opacity", opacity)
        }
        
        // Create horizontal grid lines
        const startY = Math.floor(topBound / GRID_SIZE) * GRID_SIZE
        const endY = Math.ceil(bottomBound / GRID_SIZE) * GRID_SIZE
        
        for (let y = startY; y <= endY; y += GRID_SIZE) {
          gridGroup.append("line")
            .attr("x1", leftBound)
            .attr("y1", y)
            .attr("x2", rightBound)
            .attr("y2", y)
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", strokeWidth)
            .attr("opacity", opacity)
        }
      }
    }
  }, [showGrid])

  // ✅ Update connection styles เมื่อ selectedConnection เปลี่ยน
  useEffect(() => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    const mainGroup = svg.select('g')
    const connectionLayer = mainGroup.select('.connection-layer')
    
    // Update all connection paths
    connectionLayer.selectAll('.connection-path')
      .attr("stroke", (d: any) => selectedConnection?.id === d.id ? "#2196F3" : "#666")
      .attr("stroke-width", (d: any) => selectedConnection?.id === d.id ? 3 : 2)
      .attr("marker-end", (d: any) => selectedConnection?.id === d.id ? "url(#arrowhead-selected)" : "url(#arrowhead)")
      
  }, [selectedConnection])

  // ✅ Update grid เมื่อ showGrid state เปลี่ยน
  useEffect(() => {
    // เรียกใช้ createGrid function จาก main useEffect
    if (gridUpdateRef.current) {
      gridUpdateRef.current()
    }
  }, [showGrid])

  return (
    <div className="advanced-workflow-designer">
      {/* Enhanced Header */}
      <div className="designer-header">
        <div className="header-left">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="workflow-name-input"
            placeholder="Workflow Name"
          />
          <div className={`status-indicator ${executionState.status}`}>
            {executionState.status === 'running' && '⚡ Running'}
            {executionState.status === 'completed' && '✅ Completed'}
            {executionState.status === 'error' && '❌ Error'}
            {executionState.status === 'idle' && '⭕ Idle'}
          </div>
          {/* 🚀 Multi-select indicators */}
          {selectedNodes.size > 0 && (
            <div className="selection-info">
              <span className="selected-count">
                {selectedNodes.size} node{selectedNodes.size > 1 ? 's' : ''} selected
              </span>
              {selectedNodes.size > 1 && (
                <button 
                  onClick={() => clearSelection()} 
                  className="btn btn-sm"
                  title="Clear selection"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {isMultiSelectMode && (
            <div className="mode-indicator">
              <span className="mode-badge">Multi-Select Mode (Shift)</span>
            </div>
          )}
        </div>
        <div className="header-actions">
          <div className={`ws-status ${wsStatus}`} title={`WebSocket: ${wsStatus}`}>
            <div className="status-dot" />
            {(() => {
              if (wsStatus === 'connected') return 'Live'
              if (wsStatus === 'connecting') return 'Connecting...'
              return 'Offline'
            })()}
          </div>
          <button onClick={saveWorkflow} className="btn btn-primary">
            <Save size={16} /> Save
          </button>
          <button 
            onClick={executeWorkflow} 
            className="btn btn-success"
            disabled={executionState.status === 'running'}
          >
            <Play size={16} /> Execute
          </button>
          <button onClick={exportWorkflow} className="btn">
            <Download size={16} /> Export
          </button>
          <label className="btn">
            <Upload size={16} /> Import
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importWorkflow(file)
              }}
            />
          </label>
        </div>
      </div>

      <div className="designer-content">
        {/* Enhanced Node Palette */}
        <NodePalette onAddNode={addNode} />
        
        <div 
          className="canvas-container" 
          ref={containerRef}
          role="application"
          aria-label="Workflow designer canvas"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Enhanced Toolbar */}
          <div className="canvas-toolbar">
            <button onClick={zoomIn} className="toolbar-btn" title="Zoom In">
              <ZoomIn size={16} />
            </button>
            <button onClick={zoomOut} className="toolbar-btn" title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <button onClick={fitToScreen} className="toolbar-btn" title="Fit to Screen">
              <Maximize2 size={16} />
            </button>
            <button onClick={resetCanvasPosition} className="toolbar-btn" title="Reset View">
              <RotateCcw size={16} />
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <div className="toolbar-separator" />
            <button 
              onClick={() => setShowGrid(!showGrid)} 
              className={`toolbar-btn ${showGrid ? 'active' : ''}`}
              title="Toggle Grid"
            >
              {showGrid ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            {(selectedNode || selectedConnection) && (
              <>
                <div className="toolbar-separator" />
                <button 
                  onClick={() => {
                    if (selectedConnection) {
                      removeConnection(selectedConnection.id)
                      setSelectedConnection(null)
                    } else if (selectedNode) {
                      deleteNode(selectedNode.id)
                    }
                  }} 
                  className="toolbar-btn danger"
                  title="Delete Selected"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
          
          {isConnecting && (
            <div className="connection-hint">
              🔗 Click on a target port to create connection
            </div>
          )}
          
          <svg 
            ref={svgRef} 
            className="workflow-canvas"
            width="100%" 
            height="100%"
            data-dragover={isDragOver}
            onClick={handleCanvasClick}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
          />
          
          {executionState.status === 'running' && executionState.currentNode && (
            <div className="execution-indicator">
              ⚡ Executing: {nodes.find(n => n.id === executionState.currentNode)?.label}
            </div>
          )}
        </div>

        {/* Enhanced Node Editor */}
        {selectedNode && showNodeEditor && (
          <div className="node-editor-panel">
            <div className="panel-header">
              <h3>Node Editor</h3>
              <button 
                className="close-btn"
                onClick={() => setShowNodeEditor(false)}
                title="Close panel"
              >
                ✕
              </button>
            </div>
            <NodeEditor
              node={selectedNode}
              onUpdate={(config) => {
                setNodes(prev => prev.map(n => 
                  n.id === selectedNode.id 
                    ? { ...n, config } 
                    : n
                ))
                setSelectedNode({ ...selectedNode, config })
              }}
              onDelete={() => {
                deleteNode(selectedNode.id)
                setShowNodeEditor(false)
              }}
              onDuplicate={() => {
                const newNode: WorkflowNode = {
                  ...selectedNode,
                  id: `node-${Date.now()}`,
                  x: selectedNode.x + 50,
                  y: selectedNode.y + 50
                }
                setNodes(prev => [...prev, newNode])
                setSelectedNode(newNode)
                setShowNodeEditor(true)
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        .advanced-workflow-designer {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .designer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: white;
          border-bottom: 1px solid #e0e0e0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .workflow-name-input {
          font-size: 1.25rem;
          font-weight: 600;
          border: none;
          background: transparent;
          padding: 0.5rem;
          border-radius: 4px;
          transition: all 0.2s;
          min-width: 200px;
        }

        .workflow-name-input:hover {
          background: #f5f5f5;
        }

        .workflow-name-input:focus {
          outline: none;
          background: white;
          box-shadow: 0 0 0 2px #2196F3;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .status-indicator.idle { background: #f5f5f5; color: #666; }
        .status-indicator.running { background: #fff3e0; color: #f57c00; }
        .status-indicator.completed { background: #e8f5e8; color: #2e7d32; }
        .status-indicator.error { background: #ffebee; color: #c62828; }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .ws-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          font-size: 0.75rem;
          margin-right: 1rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ccc;
        }

        .ws-status.connected .status-dot { background: #4caf50; }
        .ws-status.connecting .status-dot { background: #ff9800; }
        .ws-status.disconnected .status-dot { background: #f44336; }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          color: inherit;
        }

        .btn:hover {
          background: #f5f5f5;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #2196F3;
          color: white;
          border-color: #2196F3;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1976D2;
        }

        .btn-success {
          background: #4CAF50;
          color: white;
          border-color: #4CAF50;
        }

        .btn-success:hover:not(:disabled) {
          background: #388E3C;
        }

        .designer-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .canvas-container {
          flex: 1;
          position: relative;
          background: #fafafa;
        }

        .canvas-toolbar {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          z-index: 10;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.5rem;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.75rem;
          color: #666;
        }

        .toolbar-btn:hover {
          background: #f5f5f5;
          color: #333;
        }

        .toolbar-btn.active {
          background: #e3f2fd;
          color: #2196F3;
        }

        .toolbar-btn.danger:hover {
          background: #ffebee;
          color: #f44336;
        }

        .zoom-level {
          padding: 0 0.5rem;
          font-size: 0.75rem;
          color: #666;
          min-width: 40px;
          text-align: center;
        }

        .toolbar-separator {
          width: 1px;
          height: 20px;
          background: #e0e0e0;
          margin: 0 0.25rem;
        }

        .workflow-canvas {
          cursor: grab;
          user-select: none;
        }

        .workflow-canvas:active {
          cursor: grabbing;
        }

        .node {
          cursor: move;
          transition: filter 0.2s ease, transform 0.2s ease;
        }

        .node:hover {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }

        .node rect {
          transition: all 0.2s ease;
        }

        .node.dragging rect {
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25)) !important;
          transform: scale(1.03);
          transform-origin: center;
        }

        .connection-path {
          transition: d 0.1s ease;
          pointer-events: stroke;
          stroke-linecap: round;
        }

        .connection-path:hover {
          stroke-width: 3px;
          filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.3));
        }

        .workflow-canvas[data-dragover="true"] {
          background-color: rgba(76, 175, 80, 0.1);
          outline: 2px dashed #4CAF50;
          outline-offset: -2px;
        }

        .node-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .node-item:active {
          transform: scale(0.95);
        }

        .connection-hint {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(33, 150, 243, 0.9);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          pointer-events: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .execution-indicator {
          position: absolute;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 167, 38, 0.9);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .node-editor-panel {
          width: 320px;
          background: white;
          border-left: 1px solid #e0e0e0;
          box-shadow: -2px 0 8px rgba(0,0,0,0.05);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #333;
        }

        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          color: #666;
          font-size: 14px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: #e0e0e0;
          color: #333;
        }

        /* 🚀 Multi-select and selection styling */
        .selection-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 16px;
          padding: 4px 8px;
          background: rgba(33, 150, 243, 0.1);
          border: 1px solid rgba(33, 150, 243, 0.3);
          border-radius: 4px;
          font-size: 12px;
        }
        
        .selected-count {
          color: #1976d2;
          font-weight: 500;
        }
        
        .mode-indicator {
          margin-left: 12px;
        }
        
        .mode-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #ff9800;
          color: white;
          font-size: 10px;
          font-weight: 500;
          border-radius: 2px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Selection box styling */
        .selection-box {
          pointer-events: none;
          opacity: 0.8;
        }

        /* Enhanced node selection styling */
        .node.selected {
          filter: drop-shadow(0 0 8px rgba(33, 150, 243, 0.5));
        }
        
        .node.dragging {
          filter: drop-shadow(0 0 12px rgba(33, 150, 243, 0.8));
          cursor: grabbing !important;
        }

        /* Group drag indicators */
        .node.group-selected {
          filter: drop-shadow(0 0 6px rgba(76, 175, 80, 0.4));
        }

        /* Keyboard shortcuts info */
        .shortcuts-info {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 11px;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        
        .advanced-workflow-designer:hover .shortcuts-info {
          opacity: 1;
        }
        
        .shortcut-item {
          display: block;
          margin: 2px 0;
        }
        
        .shortcut-key {
          background: rgba(255, 255, 255, 0.2);
          padding: 1px 4px;
          border-radius: 2px;
          font-family: monospace;
          font-size: 10px;
        }
      `}</style>
      
      {/* Keyboard shortcuts info */}
      <div className="shortcuts-info">
        <div className="shortcut-item">
          <span className="shortcut-key">Ctrl/Cmd + Click</span> Multi-select
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Shift</span> Multi-select mode
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Ctrl/Cmd + A</span> Select all
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Drag</span> Box select
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Delete</span> Delete selected
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Esc</span> Clear selection
        </div>
      </div>
    </div>
  )
}