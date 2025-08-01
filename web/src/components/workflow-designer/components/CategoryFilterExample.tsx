// CategoryFilterExample.tsx - Updated example with working inline filter
import React, { useState } from 'react'
import BaseNodePalette, { NodePaletteItem } from './BaseNodePalette'
import { 
  Database, 
  Globe, 
  Server, 
  Cloud, 
  Lock, 
  Cpu, 
  HardDrive,
  Network,
  Shield
} from 'lucide-react'

// Sample nodes data
const sampleNodes: NodePaletteItem[] = [
  // Infrastructure
  { type: 'server', label: 'Server', icon: Server, category: 'Infrastructure', description: 'Physical or virtual server', color: '#10b981' },
  { type: 'database', label: 'Database', icon: Database, category: 'Infrastructure', description: 'Database instance', color: '#3b82f6' },
  { type: 'storage', label: 'Storage', icon: HardDrive, category: 'Infrastructure', description: 'Storage volume', color: '#8b5cf6' },
  { type: 'network', label: 'Network', icon: Network, category: 'Infrastructure', description: 'Network component', color: '#06b6d4' },
  { type: 'compute', label: 'Compute', icon: Cpu, category: 'Infrastructure', description: 'Computing resource', color: '#f59e0b' },
  
  // Services
  { type: 'api', label: 'API Gateway', icon: Globe, category: 'Services', description: 'API management service', color: '#ef4444' },
  { type: 'load-balancer', label: 'Load Balancer', icon: Network, category: 'Services', description: 'Traffic distribution', color: '#84cc16' },
  { type: 'auth', label: 'Authentication', icon: Shield, category: 'Services', description: 'User authentication', color: '#f97316' },
  { type: 'cache', label: 'Cache', icon: Database, category: 'Services', description: 'Caching layer', color: '#ec4899' },
  
  // Cloud
  { type: 'aws-ec2', label: 'AWS EC2', icon: Cloud, category: 'Cloud', description: 'Amazon EC2 instance', color: '#ff9500' },
  { type: 'azure-vm', label: 'Azure VM', icon: Cloud, category: 'Cloud', description: 'Azure Virtual Machine', color: '#0078d4' },
  { type: 'gcp-compute', label: 'GCP Compute', icon: Cloud, category: 'Cloud', description: 'Google Compute Engine', color: '#4285f4' },
  
  // Security
  { type: 'firewall', label: 'Firewall', icon: Lock, category: 'Security', description: 'Network firewall', color: '#dc2626' },
  { type: 'vpn', label: 'VPN Gateway', icon: Shield, category: 'Security', description: 'VPN connection', color: '#7c3aed' },
]

export const CategoryFilterDemo: React.FC = () => {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])

  const categories = Array.from(new Set(sampleNodes.map(node => node.category)))

  const handleAddNode = (type: string) => {
    console.log('Adding node:', type)
    setSelectedNodes(prev => [...prev, type])
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: '600px', padding: '20px' }}>
      <div style={{ width: '300px' }}>
        <BaseNodePalette
          nodes={sampleNodes}
          onAddNode={handleAddNode}
          categories={categories}
          enableSearch={true}
          enableCategoryFilter={true}
        />
      </div>
      
      <div style={{ flex: 1, padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
        <h3>Selected Nodes:</h3>
        {selectedNodes.length === 0 ? (
          <p>No nodes selected. Click on nodes in the palette to add them.</p>
        ) : (
          <ul>
            {selectedNodes.map((nodeType, index) => {
              const node = sampleNodes.find(n => n.type === nodeType)
              return (
                <li key={`${nodeType}-${index}`}>
                  {node?.label} ({node?.category})
                </li>
              )
            })}
          </ul>
        )}
        
        <button 
          onClick={() => setSelectedNodes([])}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Clear All
        </button>
      </div>
    </div>
  )
}

export default CategoryFilterDemo
