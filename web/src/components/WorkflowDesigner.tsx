import { useState, useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { Save, Play } from 'lucide-react'
import NodePalette from './NodePalette'
import NodeEditor from './NodeEditor'
import CanvasToolbar from './workflow-designer/components/CanvasToolbar'
import { WorkflowService } from '../services/workflow.service'
import './workflow-designer/WorkflowDesigner.css'

interface Node {
  id: string
  type: string
  label: string
  x: number
  y: number
  config: any
}

interface Edge {
  source: string
  target: string
}

export default function WorkflowDesigner() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [workflowName, setWorkflowName] = useState('New Workflow')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [zoomLevel] = useState(1)

  // Zoom functions for CanvasToolbar
  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 5])
      zoom.scaleBy(svg as any, 1.2)
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 5])
      zoom.scaleBy(svg as any, 0.8)
    }
  }

  const handleFitToScreen = () => {
    if (svgRef.current && nodes.length > 0) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom<SVGSVGElement, unknown>()
      
      // Calculate bounds of all nodes
      const bounds = {
        minX: Math.min(...nodes.map(n => n.x)),
        maxX: Math.max(...nodes.map(n => n.x)),
        minY: Math.min(...nodes.map(n => n.y)),
        maxY: Math.max(...nodes.map(n => n.y))
      }
      
      const width = bounds.maxX - bounds.minX + 200
      const height = bounds.maxY - bounds.minY + 200
      const scale = Math.min(800 / width, 600 / height, 1)
      
      const transform = d3.zoomIdentity
        .translate(400 - (bounds.minX + bounds.maxX) * scale / 2, 300 - (bounds.minY + bounds.maxY) * scale / 2)
        .scale(scale)
      
      zoom.transform(svg as any, transform)
    }
  }

  const handleResetPosition = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom<SVGSVGElement, unknown>()
      zoom.transform(svg as any, d3.zoomIdentity)
    }
  }

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Clear previous content
    svg.selectAll("*").remove()

    // Add grid pattern
    if (showGrid) {
      const defs = svg.append("defs")
      const pattern = defs.append("pattern")
        .attr("id", "grid")
        .attr("width", 20)
        .attr("height", 20)
        .attr("patternUnits", "userSpaceOnUse")
      
      pattern.append("path")
        .attr("d", "M 20 0 L 0 0 0 20")
        .attr("fill", "none")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
      
      svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "url(#grid)")
    }

    // Add container
    const g = svg.append("g")
    
    // Add click handler to canvas for deselecting
    svg.on("click", () => {
      if (isConnecting) {
        setIsConnecting(false)
        setConnectionStart(null)
      } else {
        setSelectedNode(null)
      }
    })

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom as any)

    // Draw edges
    const link = g.append("g")
      .selectAll("line")
      .data(edges)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)")

    // Draw nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .call(d3.drag<any, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any)

    // Add rectangles
    node.append("rect")
      .attr("width", 180)
      .attr("height", 60)
      .attr("x", -90)
      .attr("y", -30)
      .attr("rx", 8)
      .attr("fill", "#ffffff")
      .attr("stroke", d => getNodeColor(d.type))
      .attr("stroke-width", 2)
      .attr("class", d => selectedNode?.id === d.id ? 'selected' : '')
      .on("click", (event, d) => {
        event.stopPropagation()
        if (isConnecting && connectionStart && connectionStart !== d.id) {
          // Create connection
          const newEdge = { source: connectionStart, target: d.id }
          setEdges([...edges, newEdge])
          setIsConnecting(false)
          setConnectionStart(null)
        } else {
          setSelectedNode(d)
        }
      })
      .on("contextmenu", (event, d) => {
        event.preventDefault()
        if (!isConnecting) {
          setIsConnecting(true)
          setConnectionStart(d.id)
        }
      })

    // Add icons
    node.append("text")
      .attr("x", -70)
      .attr("y", 5)
      .attr("font-family", "Arial")
      .attr("font-size", "20px")
      .text(d => getNodeIcon(d.type))

    // Add labels
    node.append("text")
      .attr("x", -40)
      .attr("y", 5)
      .attr("font-family", "Arial")
      .attr("font-size", "14px")
      .text(d => d.label)

    // Update edge positions
    function updateLinks() {
      link
        .attr("x1", d => {
          const sourceNode = nodes.find(n => n.id === d.source)
          return sourceNode ? sourceNode.x : 0
        })
        .attr("y1", d => {
          const sourceNode = nodes.find(n => n.id === d.source)
          return sourceNode ? sourceNode.y : 0
        })
        .attr("x2", d => {
          const targetNode = nodes.find(n => n.id === d.target)
          return targetNode ? targetNode.x : 0
        })
        .attr("y2", d => {
          const targetNode = nodes.find(n => n.id === d.target)
          return targetNode ? targetNode.y : 0
        })
    }

    function dragstarted(event: any, _d: Node) {
      d3.select(event.currentTarget).raise()
    }

    function dragged(event: any, d: Node) {
      d.x = event.x
      d.y = event.y
      d3.select(event.currentTarget)
        .attr("transform", `translate(${d.x},${d.y})`)
      updateLinks()
    }

    function dragended(_event: any, d: Node) {
      // Update node position
      setNodes(prev => prev.map(n => n.id === d.id ? { ...n, x: d.x, y: d.y } : n))
    }

    updateLinks()

  }, [nodes, edges])

  const getNodeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      http: '#2196F3',
      transform: '#4CAF50',
      database: '#FF9800',
      conditional: '#9C27B0',
      ai: '#F44336',
      subworkflow: '#00BCD4'
    }
    return colors[type] || '#757575'
  }

  const getNodeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      http: '🌐',
      transform: '🔄',
      database: '🗄️',
      conditional: '❓',
      ai: '🤖',
      subworkflow: '📦'
    }
    return icons[type] || '📌'
  }

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      label: `${type} Node`,
      x: 600,
      y: 300,
      config: {}
    }
    setNodes([...nodes, newNode])
  }

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId))
    setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }

  const saveWorkflow = async () => {
    const workflow = {
      name: workflowName,
      definition: {
        nodes,
        edges
      }
    }
    
    try {
      await WorkflowService.create(workflow)
      alert('Workflow saved successfully!')
    } catch (error) {
      alert('Failed to save workflow')
    }
  }

  const executeWorkflow = async () => {
    if (nodes.length === 0) {
      alert('Please add nodes to the workflow before executing')
      return
    }
    
    try {
      const workflow = {
        name: workflowName,
        definition: { nodes, edges }
      }
      
      const result = await WorkflowService.execute('temp', workflow)
      alert(`Workflow executed successfully! Execution ID: ${result.executionId}`)
    } catch (error) {
      console.error('Execution failed:', error)
      alert('Failed to execute workflow')
    }
  }
  
  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the canvas?')) {
      setNodes([])
      setEdges([])
      setSelectedNode(null)
    }
  }
  
  const duplicateNode = (node: Node) => {
    const newNode: Node = {
      ...node,
      id: `node-${Date.now()}`,
      x: node.x + 50,
      y: node.y + 50
    }
    setNodes([...nodes, newNode])
  }

  return (
    <div className="workflow-designer">
      <div className="designer-header">
        <input
          type="text"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="workflow-name-input"
        />
        <div className="designer-actions">
          <button 
            onClick={() => setShowGrid(!showGrid)} 
            className={`btn btn-secondary ${showGrid ? 'active' : ''}`}
          >
            Grid
          </button>
          <button onClick={clearCanvas} className="btn btn-warning">
            Clear
          </button>
          <button onClick={saveWorkflow} className="btn btn-primary">
            <Save size={16} /> Save
          </button>
          <button onClick={executeWorkflow} className="btn btn-success">
            <Play size={16} /> Execute
          </button>
        </div>
      </div>

      <div className="designer-content">
        <NodePalette onAddNode={addNode} />
        
        <div className="canvas-container">
          {isConnecting && (
            <div className="connection-indicator">
              🔗 Click on a target node to create connection
            </div>
          )}
          
          {/* Canvas Toolbar */}
          <CanvasToolbar
            zoomLevel={zoomLevel}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            onResetPosition={handleResetPosition}
            onSave={saveWorkflow}
            onExecute={executeWorkflow}
            executionStatus="idle"
            selectedNodeCount={selectedNode ? 1 : 0}
          />
          
          <svg ref={svgRef} width="100%" height="600">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#999" />
              </marker>
            </defs>
          </svg>
          <div className="canvas-help">
            <p>💡 Right-click on a node to start connecting</p>
            <p>🖱️ Drag nodes to reposition them</p>
            <p>📝 Click on a node to configure it</p>
          </div>
        </div>

        {selectedNode && (
          <div className="node-editor-panel">
            <NodeEditor
              node={selectedNode}
              onUpdate={(config) => {
                setNodes(nodes.map(n => 
                  n.id === selectedNode.id 
                    ? { ...n, config } 
                    : n
                ))
              }}
              onDelete={() => deleteNode(selectedNode.id)}
              onDuplicate={() => duplicateNode(selectedNode)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
