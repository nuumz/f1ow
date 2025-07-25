import React from 'react'
import { Globe, Code, Database, GitBranch, Cpu, Package } from 'lucide-react'

interface NodePaletteProps {
  onAddNode: (type: string, position?: { x: number; y: number }) => void
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  const nodeTypes = [
    { type: 'http', label: 'HTTP Request', icon: Globe },
    { type: 'transform', label: 'Transform', icon: Code },
    { type: 'database', label: 'Database', icon: Database },
    { type: 'conditional', label: 'Conditional', icon: GitBranch },
    { type: 'ai', label: 'AI Agent', icon: Cpu },
    { type: 'subworkflow', label: 'Sub-workflow', icon: Package },
  ]

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/node-type', type)
    e.dataTransfer.effectAllowed = 'copy'
    
    // Add visual feedback
    const target = e.target as HTMLElement
    target.style.opacity = '0.7'
    target.style.transform = 'scale(0.95)'
  }

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset visual feedback
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    target.style.transform = 'scale(1)'
  }

  return (
    <div className="node-palette">
      <h3>Node Types</h3>
      <div className="node-list">
        {nodeTypes.map(({ type, label, icon: Icon }) => (
          <div
            key={type}
            className="node-item"
            onClick={() => onAddNode(type)}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onDragEnd={handleDragEnd}
            style={{
              transition: 'all 0.2s ease',
              cursor: 'grab'
            }}
            onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
            onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
          >
            <Icon size={20} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
