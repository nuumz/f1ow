import React from 'react'
import { Globe, Code, Database, GitBranch, Cpu, Package } from 'lucide-react'

interface NodePaletteProps {
  onAddNode: (type: string) => void
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
          >
            <Icon size={20} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
