import { useState } from 'react'
import { Download, Search, Star, Clock, Tag, Eye } from 'lucide-react'
// import { WorkflowService } from '../services/workflow.service'

interface WorkflowNode {
  id: string
  type: string
  position: [number, number]
}

interface WorkflowDefinition {
  nodes: WorkflowNode[]
  connections: unknown[]
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  author: string
  downloads: number
  rating: number
  previewImage?: string
  definition: WorkflowDefinition
  createdAt: string
  updatedAt: string
}

interface WorkflowTemplatesProps {
  onUseTemplate: (template: WorkflowTemplate) => void
}

const mockTemplates: WorkflowTemplate[] = [
  {
    id: 'template-1',
    name: 'Email Newsletter Automation',
    description: 'Automatically send personalized newsletters to subscribers with dynamic content',
    category: 'Marketing',
    tags: ['email', 'automation', 'marketing'],
    author: 'f1ow Team',
    downloads: 1247,
    rating: 4.8,
    definition: {
      nodes: [
        { id: 'start', type: 'trigger', position: [100, 100] },
        { id: 'fetch', type: 'database', position: [300, 100] },
        { id: 'personalize', type: 'ai', position: [500, 100] },
        { id: 'send', type: 'http', position: [700, 100] }
      ],
      connections: []
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z'
  },
  {
    id: 'template-2',
    name: 'Data Sync & Transform',
    description: 'Sync data between multiple databases with real-time transformation',
    category: 'Data Processing',
    tags: ['database', 'sync', 'transform'],
    author: 'DataFlow Pro',
    downloads: 892,
    rating: 4.6,
    definition: {
      nodes: [
        { id: 'source', type: 'database', position: [100, 100] },
        { id: 'transform', type: 'transform', position: [300, 100] },
        { id: 'validate', type: 'conditional', position: [500, 100] },
        { id: 'target', type: 'database', position: [700, 100] }
      ],
      connections: []
    },
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-18T12:15:00Z'
  },
  {
    id: 'template-3',
    name: 'AI Content Generation',
    description: 'Generate and publish content across multiple platforms using AI',
    category: 'AI/ML',
    tags: ['ai', 'content', 'automation'],
    author: 'AI Workflows',
    downloads: 2156,
    rating: 4.9,
    definition: {
      nodes: [
        { id: 'prompt', type: 'trigger', position: [100, 100] },
        { id: 'generate', type: 'ai', position: [300, 100] },
        { id: 'review', type: 'conditional', position: [500, 100] },
        { id: 'publish', type: 'http', position: [700, 100] }
      ],
      connections: []
    },
    createdAt: '2024-01-08T14:20:00Z',
    updatedAt: '2024-01-22T09:45:00Z'
  },
  {
    id: 'template-4',
    name: 'API Monitoring & Alerts',
    description: 'Monitor API endpoints and send alerts when issues are detected',
    category: 'Monitoring',
    tags: ['api', 'monitoring', 'alerts'],
    author: 'DevOps Hub',
    downloads: 654,
    rating: 4.4,
    definition: {
      nodes: [
        { id: 'monitor', type: 'http', position: [100, 100] },
        { id: 'check', type: 'conditional', position: [300, 100] },
        { id: 'alert', type: 'http', position: [500, 100] },
        { id: 'log', type: 'database', position: [700, 100] }
      ],
      connections: []
    },
    createdAt: '2024-01-12T16:30:00Z',
    updatedAt: '2024-01-19T11:20:00Z'
  }
]

const categories = Array.from(new Set(mockTemplates.map(t => t.category)))

export default function WorkflowTemplates({ onUseTemplate }: WorkflowTemplatesProps) {
  const [templates] = useState<WorkflowTemplate[]>(mockTemplates)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'recent'>('downloads')
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null)

  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = !selectedCategory || template.category === selectedCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'downloads':
          return b.downloads - a.downloads
        case 'rating':
          return b.rating - a.rating
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        default:
          return 0
      }
    })

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        fill={i < Math.floor(rating) ? '#ffc107' : 'none'}
        color={i < Math.floor(rating) ? '#ffc107' : '#ddd'}
      />
    ))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDownloads = (downloads: number) => {
    if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}k`
    }
    return downloads.toString()
  }

  return (
    <div className="page-container">
      <div className="container">
        <div className="workflow-templates">
          <div className="templates-header">
        <div className="header-title">
          <h2>Workflow Templates</h2>
          <p>Get started quickly with pre-built workflow templates</p>
        </div>
        
        <div className="header-controls">
          <div className="search-container">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'downloads' | 'rating' | 'recent')}
            className="sort-select"
          >
            <option value="downloads">Most Downloaded</option>
            <option value="rating">Highest Rated</option>
            <option value="recent">Recently Updated</option>
          </select>
        </div>
      </div>

      <div className="templates-filters">
        <button
          className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          All Categories
        </button>
        {categories.map(category => (
          <button
            key={category}
            className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="templates-grid">
        {filteredTemplates.map(template => (
          <div key={template.id} className="template-card">
            <div className="template-header">
              <h3>{template.name}</h3>
              <div className="template-rating">
                <div className="stars">
                  {renderStars(template.rating)}
                </div>
                <span className="rating-value">{template.rating}</span>
              </div>
            </div>
            
            <p className="template-description">{template.description}</p>
            
            <div className="template-meta">
              <div className="template-category">
                <Tag size={12} />
                {template.category}
              </div>
              <div className="template-stats">
                <div className="stat">
                  <Download size={12} />
                  {formatDownloads(template.downloads)}
                </div>
                <div className="stat">
                  <Clock size={12} />
                  {formatDate(template.updatedAt)}
                </div>
              </div>
            </div>
            
            <div className="template-tags">
              {template.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            
            <div className="template-author">
              by <strong>{template.author}</strong>
            </div>
            
            <div className="template-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewTemplate(template)}
              >
                <Eye size={14} />
                Preview
              </button>
              <button
                className="btn btn-primary"
                onClick={() => onUseTemplate(template)}
              >
                <Download size={14} />
                Use Template
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="empty-templates">
          <h3>No templates found</h3>
          <p>Try adjusting your search terms or category filter</p>
        </div>
      )}

      {previewTemplate && (
        <>
          <div className="modal-backdrop" onClick={() => setPreviewTemplate(null)} />
          <div className="modal template-preview-modal">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3>{previewTemplate.name}</h3>
                <button
                  className="modal-close"
                  onClick={() => setPreviewTemplate(null)}
                >
                  ×
                </button>
              </div>
            
            <div className="modal-body">
              <div className="preview-info">
                <p><strong>Description:</strong> {previewTemplate.description}</p>
                <p><strong>Category:</strong> {previewTemplate.category}</p>
                <p><strong>Author:</strong> {previewTemplate.author}</p>
                
                <div className="preview-stats">
                  <div className="stat">
                    <Download size={16} />
                    <span>{formatDownloads(previewTemplate.downloads)} downloads</span>
                  </div>
                  <div className="stat">
                    <div className="stars">
                      {renderStars(previewTemplate.rating)}
                    </div>
                    <span>{previewTemplate.rating} rating</span>
                  </div>
                </div>
                
                <div className="preview-tags">
                  {previewTemplate.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="preview-workflow">
                <h4>Workflow Structure</h4>
                <div className="workflow-nodes">
                  {previewTemplate.definition.nodes.map((node: WorkflowNode) => (
                    <div key={node.id} className="preview-node">
                      <div className="node-type">{node.type}</div>
                      <div className="node-id">{node.id}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewTemplate(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onUseTemplate(previewTemplate)
                  setPreviewTemplate(null)
                }}
              >
                <Download size={16} />
                Use This Template
              </button>
            </div>
            </div>
          </div>
        </>
      )}
        </div>
      </div>
    </div>
  )
}