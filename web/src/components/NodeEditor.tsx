import React, { useState, useEffect } from 'react'
import { X, Save, Trash2, Settings } from 'lucide-react'

interface Node {
  id: string
  type: string
  label: string
  x: number
  y: number
  config: any
}

interface NodeEditorProps {
  node: Node
  onUpdate: (config: any) => void
  onDelete: () => void
  onDuplicate?: () => void
}

export default function NodeEditor({ node, onUpdate, onDelete, onDuplicate }: NodeEditorProps) {
  const [config, setConfig] = useState(node.config || {})
  const [activeTab, setActiveTab] = useState('basic')

  useEffect(() => {
    setConfig(node.config || {})
  }, [node])

  const handleSave = () => {
    onUpdate(config)
  }

  const renderBasicConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>Node Name</label>
        <input
          type="text"
          value={config.name || ''}
          onChange={(e) => setConfig({...config, name: e.target.value})}
          placeholder="Enter node name"
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={config.description || ''}
          onChange={(e) => setConfig({...config, description: e.target.value})}
          placeholder="Enter description"
          rows={3}
        />
      </div>
    </div>
  )

  const renderHttpConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>HTTP Method</label>
        <select
          value={config.method || 'GET'}
          onChange={(e) => setConfig({...config, method: e.target.value})}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>
      <div className="form-group">
        <label>URL</label>
        <input
          type="text"
          value={config.url || ''}
          onChange={(e) => setConfig({...config, url: e.target.value})}
          placeholder="https://api.example.com/endpoint"
        />
      </div>
      <div className="form-group">
        <label>Headers (JSON)</label>
        <textarea
          value={config.headers || ''}
          onChange={(e) => setConfig({...config, headers: e.target.value})}
          placeholder='{"Content-Type": "application/json"}'
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>Request Body (JSON)</label>
        <textarea
          value={config.body || ''}
          onChange={(e) => setConfig({...config, body: e.target.value})}
          placeholder='{"key": "value"}'
          rows={4}
        />
      </div>
    </div>
  )

  const renderTransformConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>JavaScript Code</label>
        <textarea
          value={config.code || ''}
          onChange={(e) => setConfig({...config, code: e.target.value})}
          placeholder="// Transform function\nfunction transform(input) {\n  return input;\n}"
          rows={10}
          className="code-editor"
        />
      </div>
      <div className="form-group">
        <label>Output Variable Name</label>
        <input
          type="text"
          value={config.outputVariable || 'result'}
          onChange={(e) => setConfig({...config, outputVariable: e.target.value})}
          placeholder="result"
        />
      </div>
    </div>
  )

  const renderDatabaseConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>Database Type</label>
        <select
          value={config.dbType || 'postgresql'}
          onChange={(e) => setConfig({...config, dbType: e.target.value})}
        >
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="redis">Redis</option>
        </select>
      </div>
      <div className="form-group">
        <label>Connection String</label>
        <input
          type="password"
          value={config.connectionString || ''}
          onChange={(e) => setConfig({...config, connectionString: e.target.value})}
          placeholder="Database connection string"
        />
      </div>
      <div className="form-group">
        <label>Query</label>
        <textarea
          value={config.query || ''}
          onChange={(e) => setConfig({...config, query: e.target.value})}
          placeholder="SELECT * FROM users WHERE id = $1"
          rows={5}
          className="code-editor"
        />
      </div>
      <div className="form-group">
        <label>Parameters (JSON Array)</label>
        <input
          type="text"
          value={config.parameters || ''}
          onChange={(e) => setConfig({...config, parameters: e.target.value})}
          placeholder='["param1", "param2"]'
        />
      </div>
    </div>
  )

  const renderConditionalConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>Condition Expression</label>
        <textarea
          value={config.condition || ''}
          onChange={(e) => setConfig({...config, condition: e.target.value})}
          placeholder="input.status === 'active'"
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>True Branch Output</label>
        <input
          type="text"
          value={config.trueBranch || 'true_path'}
          onChange={(e) => setConfig({...config, trueBranch: e.target.value})}
          placeholder="true_path"
        />
      </div>
      <div className="form-group">
        <label>False Branch Output</label>
        <input
          type="text"
          value={config.falseBranch || 'false_path'}
          onChange={(e) => setConfig({...config, falseBranch: e.target.value})}
          placeholder="false_path"
        />
      </div>
    </div>
  )

  const renderAiConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>AI Provider</label>
        <select
          value={config.provider || 'openai'}
          onChange={(e) => setConfig({...config, provider: e.target.value})}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="cohere">Cohere</option>
          <option value="huggingface">Hugging Face</option>
        </select>
      </div>
      <div className="form-group">
        <label>Model</label>
        <input
          type="text"
          value={config.model || 'gpt-3.5-turbo'}
          onChange={(e) => setConfig({...config, model: e.target.value})}
          placeholder="gpt-3.5-turbo"
        />
      </div>
      <div className="form-group">
        <label>System Prompt</label>
        <textarea
          value={config.systemPrompt || ''}
          onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
          placeholder="You are a helpful assistant..."
          rows={4}
        />
      </div>
      <div className="form-group">
        <label>Temperature</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature || 0.7}
          onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})}
        />
        <span>{config.temperature || 0.7}</span>
      </div>
    </div>
  )

  const renderSubworkflowConfig = () => (
    <div className="config-section">
      <div className="form-group">
        <label>Sub-workflow ID</label>
        <input
          type="text"
          value={config.subworkflowId || ''}
          onChange={(e) => setConfig({...config, subworkflowId: e.target.value})}
          placeholder="Enter sub-workflow ID"
        />
      </div>
      <div className="form-group">
        <label>Input Mapping (JSON)</label>
        <textarea
          value={config.inputMapping || ''}
          onChange={(e) => setConfig({...config, inputMapping: e.target.value})}
          placeholder='{"param1": "input.value1"}'
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>Output Mapping (JSON)</label>
        <textarea
          value={config.outputMapping || ''}
          onChange={(e) => setConfig({...config, outputMapping: e.target.value})}
          placeholder='{"result": "output.data"}'
          rows={3}
        />
      </div>
    </div>
  )

  const renderTypeSpecificConfig = () => {
    switch (node.type) {
      case 'http':
        return renderHttpConfig()
      case 'transform':
        return renderTransformConfig()
      case 'database':
        return renderDatabaseConfig()
      case 'conditional':
        return renderConditionalConfig()
      case 'ai':
        return renderAiConfig()
      case 'subworkflow':
        return renderSubworkflowConfig()
      default:
        return <div>No specific configuration for this node type.</div>
    }
  }

  return (
    <div className="node-editor">
      <div className="editor-header">
        <div className="editor-title">
          <Settings size={20} />
          <span>Configure {node.type} Node</span>
        </div>
        <button className="close-btn" onClick={() => {}}>
          <X size={20} />
        </button>
      </div>

      <div className="editor-tabs">
        <button
          className={`tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          Basic
        </button>
        <button
          className={`tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Configuration
        </button>
      </div>

      <div className="editor-content">
        {activeTab === 'basic' ? renderBasicConfig() : renderTypeSpecificConfig()}
      </div>

      <div className="editor-actions">
        <button className="btn btn-danger" onClick={onDelete}>
          <Trash2 size={16} />
          Delete
        </button>
        {onDuplicate && (
          <button className="btn btn-secondary" onClick={onDuplicate}>
            Copy
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  )
}