import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, EyeOff, Lock, Key, Shield, AlertTriangle } from 'lucide-react'

interface Credential {
  id: string
  name: string
  type: string
  description?: string
  fields: Record<string, any>
  encrypted: boolean
  createdAt: string
  updatedAt: string
  usedBy: string[] // workflow IDs that use this credential
}

interface CredentialType {
  id: string
  name: string
  icon: React.ComponentType<any>
  fields: CredentialField[]
  description: string
}

interface CredentialField {
  name: string
  label: string
  type: 'text' | 'password' | 'email' | 'url' | 'number' | 'textarea'
  required: boolean
  placeholder?: string
  validation?: string
  sensitive?: boolean
}

const credentialTypes: CredentialType[] = [
  {
    id: 'http-auth',
    name: 'HTTP Authentication',
    icon: Shield,
    description: 'Basic HTTP authentication credentials',
    fields: [
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true, sensitive: true }
    ]
  },
  {
    id: 'api-key',
    name: 'API Key',
    icon: Key,
    description: 'API key based authentication',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, sensitive: true },
      { name: 'header', label: 'Header Name', type: 'text', required: false, placeholder: 'Authorization' }
    ]
  },
  {
    id: 'oauth2',
    name: 'OAuth2',
    icon: Lock,
    description: 'OAuth2 authentication flow',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, sensitive: true },
      { name: 'tokenUrl', label: 'Token URL', type: 'url', required: true },
      { name: 'scope', label: 'Scope', type: 'text', required: false }
    ]
  },
  {
    id: 'database',
    name: 'Database Connection',
    icon: Shield,
    description: 'Database connection credentials',
    fields: [
      { name: 'host', label: 'Host', type: 'text', required: true },
      { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '5432' },
      { name: 'database', label: 'Database Name', type: 'text', required: true },
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true, sensitive: true }
    ]
  }
]

export default function CredentialManager() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedType, setSelectedType] = useState<CredentialType | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [showSensitiveFields, setShowSensitiveFields] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data for demonstration
  useEffect(() => {
    const mockCredentials: Credential[] = [
      {
        id: 'cred-1',
        name: 'GitHub API',
        type: 'api-key',
        description: 'GitHub API access token',
        fields: { apiKey: '***hidden***', header: 'Authorization' },
        encrypted: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T15:30:00Z',
        usedBy: ['workflow-1', 'workflow-3']
      },
      {
        id: 'cred-2',
        name: 'Production Database',
        type: 'database',
        description: 'Main production PostgreSQL database',
        fields: { host: 'prod-db.example.com', port: 5432, database: 'maindb', username: 'app_user', password: '***hidden***' },
        encrypted: true,
        createdAt: '2024-01-10T08:00:00Z',
        updatedAt: '2024-01-18T12:15:00Z',
        usedBy: ['workflow-2', 'workflow-4', 'workflow-5']
      },
      {
        id: 'cred-3',
        name: 'Slack Webhook',
        type: 'http-auth',
        description: 'Slack notification webhook',
        fields: { username: 'workflow-bot', password: '***hidden***' },
        encrypted: true,
        createdAt: '2024-01-08T14:20:00Z',
        updatedAt: '2024-01-22T09:45:00Z',
        usedBy: ['workflow-1']
      }
    ]
    setCredentials(mockCredentials)
  }, [])

  const filteredCredentials = credentials.filter(cred =>
    cred.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cred.description && cred.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getCredentialType = (typeId: string) => {
    return credentialTypes.find(t => t.id === typeId)
  }

  const handleCreateCredential = () => {
    setSelectedType(null)
    setFormData({})
    setShowCreateModal(true)
    setIsEditing(false)
  }

  const handleEditCredential = (credential: Credential) => {
    setSelectedCredential(credential)
    setSelectedType(getCredentialType(credential.type) || null)
    setFormData(credential.fields)
    setShowCreateModal(true)
    setIsEditing(true)
  }

  const handleDeleteCredential = (credentialId: string) => {
    const credential = credentials.find(c => c.id === credentialId)
    if (credential && credential.usedBy.length > 0) {
      alert(`Cannot delete credential "${credential.name}" as it is being used by ${credential.usedBy.length} workflow(s)`)
      return
    }
    
    if (confirm('Are you sure you want to delete this credential? This action cannot be undone.')) {
      setCredentials(prev => prev.filter(c => c.id !== credentialId))
    }
  }

  const handleSaveCredential = () => {
    if (!selectedType) return
    
    const newCredential: Credential = {
      id: isEditing ? selectedCredential!.id : `cred-${Date.now()}`,
      name: formData.name || 'Unnamed Credential',
      type: selectedType.id,
      description: formData.description,
      fields: { ...formData },
      encrypted: true,
      createdAt: isEditing ? selectedCredential!.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usedBy: isEditing ? selectedCredential!.usedBy : []
    }
    
    // Remove name and description from fields
    delete newCredential.fields.name
    delete newCredential.fields.description
    
    if (isEditing) {
      setCredentials(prev => prev.map(c => c.id === newCredential.id ? newCredential : c))
    } else {
      setCredentials(prev => [...prev, newCredential])
    }
    
    setShowCreateModal(false)
    setSelectedCredential(null)
    setFormData({})
  }

  const toggleSensitiveField = (fieldName: string) => {
    setShowSensitiveFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="page-container">
      <div className="container">
        <div className="credential-manager">
          <div className="credential-header">
            <div className="header-title">
              <h1>Credential Manager</h1>
              <p>Securely manage authentication credentials for your workflows</p>
            </div>
            
            <div className="header-actions">
              <button className="add-credential-btn" onClick={handleCreateCredential}>
                <Plus size={16} />
                Add Credential
              </button>
            </div>
          </div>

          <div className="credential-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search credentials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

      <div className="credentials-grid">
        {filteredCredentials.map(credential => {
          const credType = getCredentialType(credential.type)
          const Icon = credType?.icon || Shield
          
          return (
            <div key={credential.id} className="credential-card">
              <div className="card-header">
                <div className="credential-info">
                  <h3 className="credential-name">{credential.name}</h3>
                  <div className="credential-type">
                    <Icon className="type-icon" size={16} />
                    {credType?.name || credential.type}
                  </div>
                </div>
                <div className="card-actions">
                  <button
                    className="action-btn"
                    onClick={() => handleEditCredential(credential)}
                    title="Edit credential"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={() => handleDeleteCredential(credential.id)}
                    title="Delete credential"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="card-content">
                {credential.description && (
                  <p className="credential-description">{credential.description}</p>
                )}
                
                <div className="credential-stats">
                  <div className="stat">
                    <Lock size={14} />
                    <span>Encrypted</span>
                  </div>
                  <div className="stat">
                    <span>Used by {credential.usedBy.length} workflow{credential.usedBy.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                <div className="credential-dates">
                  <div>Created: {formatDate(credential.createdAt)}</div>
                  <div>Updated: {formatDate(credential.updatedAt)}</div>
                </div>
                
                {credential.usedBy.length > 0 && (
                  <div className="usage-warning">
                    <AlertTriangle size={14} />
                    <span>Used by active workflows</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredCredentials.length === 0 && (
        <div className="empty-credentials">
          <div className="empty-icon">
            <Shield size={48} />
          </div>
          <h3>No credentials found</h3>
          <p>Create your first credential to securely store authentication information</p>
          <button className="add-credential-btn" onClick={handleCreateCredential}>
            <Plus size={16} />
            Add Your First Credential
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="credential-modal">
          <div 
            className="modal-backdrop" 
            onClick={() => setShowCreateModal(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && setShowCreateModal(false)}
            aria-label="Close modal"
          />
          <div className="modal-content">
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Credential' : 'Create New Credential'}</h2>
              <button
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {!selectedType ? (
                <div className="credential-type-selector">
                  <h4 className="section-title">Select Credential Type</h4>
                  <div className="type-grid">
                    {credentialTypes.map(type => {
                      const Icon = type.icon
                      return (
                        <div
                          key={type.id}
                          className="type-option"
                          onClick={() => setSelectedType(type)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedType(type)}
                        >
                          <div className="type-icon">
                            <Icon size={32} />
                          </div>
                          <h5 className="type-name">{type.name}</h5>
                          <p className="type-description">{type.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="credential-form">
                  <div className="form-header">
                    <div className="selected-type">
                      <selectedType.icon size={24} />
                      <span>{selectedType.name}</span>
                    </div>
                    <button
                      className="btn btn-link"
                      onClick={() => setSelectedType(null)}
                    >
                      Change Type
                    </button>
                  </div>
                  
                  <div className="form-fields">
                    <div className="form-group">
                      <label htmlFor="credential-name">Credential Name *</label>
                      <input
                        id="credential-name"
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter a descriptive name"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="credential-description">Description</label>
                      <textarea
                        id="credential-description"
                        value={formData.description || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description"
                        rows={2}
                      />
                    </div>
                    
                    {selectedType.fields.map(field => (
                      <div key={field.name} className="form-group">
                        <label htmlFor={`field-${field.name}`}>
                          {field.label}
                          {field.required && <span className="required">*</span>}
                          {field.sensitive && (
                            <button
                              type="button"
                              className="toggle-visibility"
                              onClick={() => toggleSensitiveField(field.name)}
                            >
                              {showSensitiveFields[field.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </label>
                        <input
                          id={`field-${field.name}`}
                          type={field.sensitive && !showSensitiveFields[field.name] ? 'password' : field.type}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {selectedType && (
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveCredential}
                  disabled={!formData.name}
                >
                  {isEditing ? 'Update Credential' : 'Create Credential'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}