import { useEffect, useCallback, useState } from 'react';
import {
  Save,
  Play,
  Download,
  Upload,
  Clock,
  Layers,
  ChevronDown,
  Box,
  Webhook,
  Target,
  Network,
  Grid,
  Eye,
  Settings,
} from 'lucide-react';

// Import SCSS styles
import './WorkflowDesigner.scss';

// Import provider and hooks
import { WorkflowProvider, useWorkflowContext } from './contexts/WorkflowContext';
import { useWorkflowOperations } from './hooks/useWorkflowOperations';
import { useWorkflowCanvas } from './hooks/useWorkflowCanvas';
import { useWorkflowEventHandlers } from './hooks/useWorkflowEventHandlers';

// Import components
import WorkflowCanvas from './components/WorkflowCanvas';
import CanvasToolbar from './components/CanvasToolbar';
import DraftManager from './components/DraftManager';
import { AutoSaveStatus } from './components/AutoSaveStatus';
import WorkflowNodePalette from './components/WorkflowNodePalette';
import NodeEditor from '../NodeEditor';

// Import Architecture Components
import ArchitectureNodePalette from './components/ArchitectureNodePalette';
import { ArchitectureNodeDefinitions } from './types/architecture';
import { suggestNextNodeType } from './utils/node-suggestions';

// Import types
import type { WorkflowNode, Connection } from './types';

// Pure helpers (file-level) to avoid adding branches inside the component function
function allowArchitectureConnectionHelper(
  connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' },
  portType: 'input' | 'output' | undefined,
  targetNodeId: string,
  targetPortId: string
): boolean {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Architecture mode: SKIPPING duplicate check, allowing multiple connections');
  }

  if (connectionStart.type === 'output' && portType === 'input') {
    console.warn('Architecture mode: Allowing output -> input connection', {
      sourceNodeId: connectionStart.nodeId,
      sourcePortId: connectionStart.portId,
      targetNodeId,
      targetPortId,
    });
    return true;
  }
  if (connectionStart.type === 'input' && portType === 'output') {
    console.warn('Architecture mode: Allowing input -> output connection (reverse)', {
      sourceNodeId: connectionStart.nodeId,
      sourcePortId: connectionStart.portId,
      targetNodeId,
      targetPortId,
    });
    return true;
  }
  if (!portType) {
    console.warn('Architecture mode: Allowing connection (no portType specified)');
    return true;
  }
  console.warn('Architecture mode: Invalid connection direction', {
    connectionStartType: connectionStart.type,
    targetPortType: portType,
  });
  return false;
}

function hasExactDuplicateWorkflowHelper(
  connections: Connection[],
  connectionStart: { nodeId: string; portId: string; type: 'input' | 'output' },
  targetNodeId: string,
  targetPortId: string
): boolean {
  const duplicate = connections.find((conn) => {
    if (connectionStart.type === 'output') {
      const isDuplicate =
        conn.sourceNodeId === connectionStart.nodeId &&
        conn.sourcePortId === connectionStart.portId &&
        conn.targetNodeId === targetNodeId &&
        conn.targetPortId === targetPortId;
      if (process.env.NODE_ENV === 'development' && isDuplicate) {
        console.warn('Found duplicate (output->input):', {
          existing: {
            sourceNodeId: conn.sourceNodeId,
            sourcePortId: conn.sourcePortId,
            targetNodeId: conn.targetNodeId,
            targetPortId: conn.targetPortId,
          },
          attempted: {
            sourceNodeId: connectionStart.nodeId,
            sourcePortId: connectionStart.portId,
            targetNodeId,
            targetPortId,
          },
        });
      }
      return isDuplicate;
    }
    const isDuplicate =
      conn.sourceNodeId === targetNodeId &&
      conn.sourcePortId === targetPortId &&
      conn.targetNodeId === connectionStart.nodeId &&
      conn.targetPortId === connectionStart.portId;
    if (process.env.NODE_ENV === 'development' && isDuplicate) {
      console.warn('Found duplicate (input->output):', {
        existing: {
          sourceNodeId: conn.sourceNodeId,
          sourcePortId: conn.sourcePortId,
          targetNodeId: conn.targetNodeId,
          targetPortId: conn.targetPortId,
        },
        attempted: {
          sourceNodeId: targetNodeId,
          sourcePortId: targetPortId,
          targetNodeId: connectionStart.nodeId,
          targetPortId: connectionStart.portId,
        },
      });
    }
    return isDuplicate;
  });

  if (process.env.NODE_ENV === 'development') {
    console.warn('Duplicate check result (workflow mode):', {
      exactDuplicateExists: !!duplicate,
      totalConnections: connections.length,
      connectionStart,
      target: { targetNodeId, targetPortId },
    });
  }
  return !!duplicate;
}

// Workflow data interface
interface WorkflowData {
  readonly name: string;
  readonly nodes: WorkflowNode[];
  readonly connections: Connection[];
}

// Types
interface WorkflowDesignerProps {
  readonly initialWorkflow?: {
    readonly name?: string;
    readonly nodes?: WorkflowNode[];
    readonly connections?: Connection[];
  };
  readonly onSave?: (workflow: WorkflowData) => Promise<void>;
  readonly onExecute?: (workflow: WorkflowData) => Promise<void>;
  readonly onExport?: (workflow: WorkflowData) => void;
  readonly onImport?: (workflow: WorkflowData) => void;
  readonly className?: string;
  readonly showToolbar?: boolean;
  readonly showNodePalette?: boolean;
  readonly showStatusBar?: boolean;
  readonly readOnly?: boolean;
}

// Content component props interface
interface WorkflowDesignerContentProps {
  readonly onSave?: (workflow: WorkflowData) => Promise<void>;
  readonly onExecute?: (workflow: WorkflowData) => Promise<void>;
  readonly onExport?: (workflow: WorkflowData) => void;
  readonly onImport?: (workflow: WorkflowData) => void;
  readonly className?: string;
  readonly showToolbar?: boolean;
  readonly showNodePalette?: boolean;
  readonly showStatusBar?: boolean;
  readonly readOnly?: boolean;
}

// Workflow Designer component that uses the provider
function WorkflowDesignerContent({
  // NOSONAR: UI composition function; splitting further would hurt readability
  onSave,
  onExecute,
  onExport,
  onImport,
  className = '',
  showToolbar = true,
  showNodePalette = true,
  showStatusBar = true,
  readOnly = false,
}: WorkflowDesignerContentProps) {
  const { state, svgRef, containerRef, dispatch } = useWorkflowContext();
  const operations = useWorkflowOperations();
  const canvas = useWorkflowCanvas();
  const handlers = useWorkflowEventHandlers();

  // Simple ID generator utility for architecture nodes
  const generateId = useCallback((): string => {
    return Math.random().toString(36).substring(2, 11);
  }, []);

  // Handle adding new architecture nodes (placed after generateId to avoid TDZ)
  const handleAddArchitectureNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const definition = ArchitectureNodeDefinitions[type];
      if (!definition) {
        return;
      }

      const nodePosition = position || { x: 300, y: 200 };

      const newNode = {
        id: generateId(),
        type,
        label:
          definition.defaultConfig?.serviceName ||
          type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        x: nodePosition.x,
        y: nodePosition.y,
        config: definition.defaultConfig || {},
        inputs: definition.inputs || [],
        outputs: definition.outputs || [],
        bottomPorts: definition.bottomPorts || [],
        category:
          (definition.category as
            | 'Cloud Infrastructure'
            | 'System/Internal Service'
            | 'Database/Storage'
            | 'External Service'
            | 'Security'
            | 'Monitoring/Analytics'
            | 'DevOps/CI-CD'
            | 'Communication'
            | 'Business Logic'
            | 'Data Processing'
            | 'UI/Frontend'
            | 'Integration'
            | 'Platform Service'
            | 'Development Tool'
            | 'Network/Gateway'
            | 'Authentication'
            | 'Configuration') || 'System/Internal Service',
        metadata: {
          description: definition.description,
          category: definition.category,
        },
        status: 'idle' as const,
      };

      dispatch({ type: 'ADD_NODE', payload: newNode });
    },
    [dispatch, generateId]
  );

  // Memoized canvas handlers extracted to reduce render body complexity
  const canDropOnPort = useCallback(
    (targetNodeId: string, targetPortId: string, portType?: 'input' | 'output') => {
      const { connectionStart } = state.connectionState;
      if (process.env.NODE_ENV === 'development') {
        console.warn('canDropOnPort called:', {
          targetNodeId,
          targetPortId,
          portType,
          connectionStart,
          designerMode: state.designerMode,
        });
      }
      if (!connectionStart || connectionStart.nodeId === targetNodeId) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('canDropOnPort: No connectionStart or same node', {
            hasConnectionStart: !!connectionStart,
            sameNode: connectionStart?.nodeId === targetNodeId,
          });
        }
        return false;
      }

      if (state.designerMode === 'architecture') {
        return allowArchitectureConnectionHelper(
          connectionStart,
          portType,
          targetNodeId,
          targetPortId
        );
      }

      const exactDuplicateExists = hasExactDuplicateWorkflowHelper(
        state.connections,
        connectionStart,
        targetNodeId,
        targetPortId
      );
      if (exactDuplicateExists) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('canDropOnPort: Exact duplicate exists (workflow mode)');
        }
        return false;
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn('canDropOnPort: Entering workflow mode logic');
      }
      if (connectionStart.type === 'output') {
        const targetPortAlreadyConnected = state.connections.find(
          (conn) => conn.targetNodeId === targetNodeId && conn.targetPortId === targetPortId
        );
        return !targetPortAlreadyConnected;
      }
      return true;
    },
    [state.connectionState, state.designerMode, state.connections]
  );

  const canDropOnNode = useCallback(
    (targetNodeId: string) => {
      const { connectionStart, isConnecting } = state.connectionState;
      const canDrop = !!(
        connectionStart &&
        connectionStart.nodeId !== targetNodeId &&
        connectionStart.type === 'output'
      );
      console.warn('canDropOnNode called:', {
        targetNodeId,
        sourceNodeId: connectionStart?.nodeId,
        sourceType: connectionStart?.type,
        isConnecting,
        canDrop,
      });
      return canDrop;
    },
    [state.connectionState]
  );

  const handlePlusClick = useCallback(
    (nodeId: string, portId: string) => {
      console.warn('Plus button clicked:', { nodeId, portId });
      if (state.designerMode === 'workflow') {
        const sourceNode = state.nodes.find((n) => n.id === nodeId);
        if (!sourceNode) {
          return;
        }
        const newNodePosition = {
          x: sourceNode.x + (Math.random() - 0.5) * 100,
          y: sourceNode.y + 150,
        };
        const nextType = suggestNextNodeType(sourceNode.type, state.designerMode);
        const newNode = operations.addNode(nextType, newNodePosition);
        if (newNode && newNode.inputs.length > 0) {
          operations.createConnection(nodeId, portId, newNode.id, newNode.inputs[0].id);
        }
      } else {
        const sourceNode = state.nodes.find((n) => n.id === nodeId);
        if (!sourceNode) {
          return;
        }
        const newNodePosition = {
          x: sourceNode.x + (Math.random() - 0.5) * 100,
          y: sourceNode.y + 150,
        };
        const nextType = suggestNextNodeType('microservice', state.designerMode);
        handleAddArchitectureNode(nextType, newNodePosition);
      }
    },
  [handleAddArchitectureNode, operations, state.designerMode, state.nodes]
  );

  // File operations
  const [isLoading, setIsLoading] = useState(false);

  // Workflow name editing state
  const [isEditingName, setIsEditingName] = useState(false);

  // Architecture dropdown state
  const [architectureDropdownOpen, setArchitectureDropdownOpen] = useState(false);
  const [currentArchitectureLayout, setCurrentArchitectureLayout] = useState('microservices');
  const [currentArchitectureView, setCurrentArchitectureView] = useState('context');

  // Mode switching handler
  const handleModeSwitch = useCallback(() => {
    const newMode = state.designerMode === 'workflow' ? 'architecture' : 'workflow';
    dispatch({ type: 'SET_DESIGNER_MODE', payload: newMode });
  }, [state.designerMode, dispatch]);

  // Architecture dropdown component to reduce complexity
  const ArchitectureDropdown: React.FC = () => {
    if (state.designerMode !== 'architecture') {
      return null;
    }
    
    return (
      <div className="architecture-dropdown-container">
        <button
          onClick={() => setArchitectureDropdownOpen(!architectureDropdownOpen)}
          className="action-button architecture-dropdown-button"
          title="Architecture Settings"
          aria-haspopup="menu"
          aria-expanded={architectureDropdownOpen}
        >
          <Settings size={16} />
          <span>
            {currentArchitectureLayout === 'microservices' && <Box size={14} />}
            {currentArchitectureLayout === 'api-first' && <Webhook size={14} />}
            {currentArchitectureLayout === 'domain-driven' && <Target size={14} />}
            {currentArchitectureLayout === 'service-mesh' && <Network size={14} />}
            {currentArchitectureLayout.charAt(0).toUpperCase() +
              currentArchitectureLayout.slice(1).replace('-', ' ')}
          </span>
          <ChevronDown size={14} className={architectureDropdownOpen ? 'rotate-180' : ''} />
        </button>

        {architectureDropdownOpen && (
          <div className="architecture-dropdown-menu">
            <div className="dropdown-section">
              <h4 className="dropdown-section-title">Layout Mode</h4>
              <div className="dropdown-options">
                {[
                  { id: 'microservices', label: 'Microservices', icon: Box },
                  { id: 'api-first', label: 'API First', icon: Webhook },
                  { id: 'domain-driven', label: 'Domain Driven', icon: Target },
                  { id: 'service-mesh', label: 'Service Mesh', icon: Network },
                ].map((layout) => {
                  const IconComponent = layout.icon;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => {
                        setCurrentArchitectureLayout(layout.id);
                        // Auto-switch view mode
                        const viewMapping = {
                          microservices: 'context',
                          'api-first': 'api-flow',
                          'domain-driven': 'domain-driven',
                          'service-mesh': 'service-mesh',
                        };
                        setCurrentArchitectureView(
                          viewMapping[layout.id as keyof typeof viewMapping]
                        );
                        setArchitectureDropdownOpen(false); // Close dropdown
                      }}
                      className={`dropdown-option ${currentArchitectureLayout === layout.id ? 'active' : ''}`}
                    >
                      <IconComponent size={16} />
                      {layout.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-section">
              <h4 className="dropdown-section-title">View Mode</h4>
              <div className="dropdown-options">
                {[
                  { id: 'context', label: 'Context', icon: Grid },
                  { id: 'api-flow', label: 'API Flow', icon: Webhook },
                  { id: 'service-mesh', label: 'Service Mesh', icon: Network },
                  { id: 'domain-driven', label: 'Domain Model', icon: Target },
                ].map((view) => {
                  const IconComponent = view.icon;
                  return (
                    <button
                      key={view.id}
                      onClick={() => {
                        setCurrentArchitectureView(view.id);
                        setArchitectureDropdownOpen(false); // Close dropdown
                      }}
                      className={`dropdown-option ${currentArchitectureView === view.id ? 'active' : ''}`}
                    >
                      <IconComponent size={14} />
                      {view.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-section">
              <h4 className="dropdown-section-title">View Options</h4>
              <div className="dropdown-options">
                <label className="dropdown-toggle">
                  <input type="checkbox" defaultChecked />
                  <Grid size={14} />
                  Show Grid
                </label>
                <label className="dropdown-toggle">
                  <input type="checkbox" defaultChecked />
                  <Eye size={14} />
                  Show Labels
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render helpers to reduce cognitive complexity
  const renderNodePaletteSection = useCallback(() => {
    if (!showNodePalette) {
      return null;
    }
    if (state.designerMode === 'architecture') {
      return <ArchitectureNodePalette onAddNode={handleAddArchitectureNode} />;
    }
    return <WorkflowNodePalette onAddNode={operations.addNode} />;
  }, [handleAddArchitectureNode, operations, showNodePalette, state.designerMode]);

  const renderNodeEditorSection = useCallback(() => {
    if (state.designerMode !== 'workflow') {
      return null;
    }
    if (!state.uiState.showNodeEditor || !state.selectedNode) {
      return null;
    }
    const selected = state.selectedNode;
    return (
      <div className="node-editor-container">
        <NodeEditor
          node={selected as WorkflowNode}
          onUpdate={(config: Record<string, unknown>) => operations.updateNode(selected.id, { config })}
          onDelete={() => operations.deleteNode(selected.id)}
          onDuplicate={() => {
            const pos = { x: selected.x + 40, y: selected.y + 40 };
            operations.addNode(selected.type, pos);
          }}
        />
      </div>
    );
  }, [operations, state.designerMode, state.selectedNode, state.uiState.showNodeEditor]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showDraftManager, setShowDraftManager] = useState(false);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        try {
          setIsLoading(true);
          const result = await operations.importWorkflow(file);
          showNotification('success', 'Workflow imported successfully!');
          onImport?.({
            name: state.workflowName,
            nodes: result.nodes,
            connections: result.connections,
          });
        } catch (error) {
          console.error('Import failed:', error);
          showNotification('error', 'Failed to import workflow');
        } finally {
          setIsLoading(false);
        }
      }
      // Reset file input
      event.target.value = '';
    },
    [operations, onImport, showNotification, state.workflowName]
  );

  const handleSave = useCallback(async () => {
    try {
      setIsLoading(true);
      const workflowData = await operations.saveWorkflow();
      // Convert to WorkflowData format
      const workflow: WorkflowData = {
        name: workflowData.name,
        nodes: state.nodes,
        connections: state.connections,
      };
      await onSave?.(workflow);
      showNotification('success', 'Workflow saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      showNotification('error', 'Failed to save workflow');
    } finally {
      setIsLoading(false);
    }
  }, [operations, onSave, showNotification, state.nodes, state.connections]);

  const handleExecute = useCallback(async () => {
    try {
      setIsLoading(true);
      const workflow = {
        name: state.workflowName,
        nodes: state.nodes,
        connections: state.connections,
      };
      await onExecute?.(workflow);
      await operations.executeWorkflow();
      showNotification('success', 'Workflow executed successfully!');
    } catch (error) {
      console.error('Execute failed:', error);
      showNotification('error', 'Failed to execute workflow');
    } finally {
      setIsLoading(false);
    }
  }, [operations, onExecute, state, showNotification]);

  const handleExport = useCallback(() => {
    try {
      const workflow = {
        name: state.workflowName,
        nodes: state.nodes,
        connections: state.connections,
      };
      onExport?.(workflow);
      operations.exportWorkflow();
      showNotification('success', 'Workflow exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      showNotification('error', 'Failed to export workflow');
    }
  }, [operations, onExport, state, showNotification]);

  // Keyboard event setup
  useEffect(() => {
    document.addEventListener('keydown', handlers.handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handlers.handleKeyDown);
    };
  }, [handlers.handleKeyDown]);

  // Close architecture dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (architectureDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('.architecture-dropdown-container')) {
          setArchitectureDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [architectureDropdownOpen]);

  // Extracted sections to reduce cognitive complexity of WorkflowDesignerContent
  const HeaderSection: React.FC = () => {
    if (!showToolbar) {
      return null;
    }
    return (
      <div className="workflow-designer-header">
        <div className="workflow-name-section">
          {isEditingName ? (
            <input
              type="text"
              value={state.workflowName}
              onChange={(e) => operations.setWorkflowName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false);
                }
              }}
              className="workflow-name-input"
              placeholder="Workflow Name"
              disabled={readOnly}
              autoFocus
            />
          ) : (
            <div
              className="workflow-name-display"
              role="button"
              tabIndex={readOnly ? -1 : 0}
              onClick={() => {
                if (!readOnly) {
                  setIsEditingName(true);
                }
              }}
              onKeyDown={(e) => {
                if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setIsEditingName(true);
                }
              }}
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
            >
              <div>
                <span className="workflow-name-label">
                  {state.workflowName || 'Unnamed Workflow'}
                </span>
                <span className={`workflow-mode-badge ${state.designerMode}`}>
                  {state.designerMode === 'workflow' ? 'Workflow' : 'Architecture'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="workflow-actions">
          {/* Mode Switch Button */}
          <button
            onClick={handleModeSwitch}
            className={`action-button mode-switch-button ${state.designerMode === 'architecture' ? 'active' : ''}`}
            title={
              state.designerMode === 'workflow'
                ? 'Switch to Architecture Mode'
                : 'Switch to Workflow Mode'
            }
          >
            <Layers size={16} />
            {state.designerMode === 'workflow' ? 'Architecture' : 'Workflow'}
          </button>

          {/* Architecture Dropdown - Only show in architecture mode */}
          <ArchitectureDropdown />

          {!readOnly && (
            <>
              <button
                onClick={handleSave}
                className="action-button save-button"
                title="Save Workflow"
                disabled={isLoading}
              >
                <Save size={16} />
                {isLoading ? 'Saving...' : 'Save'}
              </button>

              {state.designerMode === 'workflow' && (
                <button
                  onClick={handleExecute}
                  className="action-button execute-button"
                  title="Execute Workflow"
                  disabled={
                    state.executionState.status === 'running' ||
                    isLoading ||
                    state.nodes.length === 0
                  }
                >
                  <Play size={16} />
                  {state.executionState.status === 'running' ? 'Running...' : 'Execute'}
                </button>
              )}
            </>
          )}

          <button
            onClick={handleExport}
            className="action-button export-button"
            title="Export Workflow"
            disabled={isLoading || state.nodes.length === 0}
          >
            <Download size={16} />
            Export
          </button>

          <button
            onClick={() => setShowDraftManager(true)}
            className="action-button draft-button"
            title="Manage Drafts"
            disabled={isLoading}
          >
            <Clock size={16} />
            Drafts
          </button>

          {!readOnly && (
            <label
              className={`action-button import-button ${isLoading ? 'disabled' : ''}`}
              title="Import Workflow"
            >
              <Upload size={16} />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={isLoading}
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  const FooterSection: React.FC = () => {
    return (
      <>
        {showStatusBar && (
          <div className="workflow-designer-status">
            <div className="status-info">
              <span>Nodes: {state.nodes.length}</span>
              <span>Connections: {state.connections.length}</span>
              <span>Selected: {state.selectedNodes.size}</span>
              <span>Zoom: {Math.round(state.canvasTransform.k * 100)}%</span>
              {state.designerMode === 'workflow' && state.executionState.status !== 'idle' && (
                <span>Status: {state.executionState.status}</span>
              )}
            </div>

            <div className="status-save-info">
              <AutoSaveStatus showFullStatus={false} />
            </div>

            {state.designerMode === 'workflow' && (
              <div className="execution-status">
                <span
                  className={`execution-status__indicator execution-status__indicator--${state.executionState.status}`}
                >
                  {state.executionState.status.toUpperCase()}
                </span>
                {state.executionState.currentNode && (
                  <span>Current: {state.executionState.currentNode}</span>
                )}
                {state.executionState.status === 'completed' &&
                  state.executionState.endTime &&
                  state.executionState.startTime &&
                  (() => {
                    const duration = Math.round(
                      (state.executionState.endTime - state.executionState.startTime) / 1000
                    );
                    return <span>Duration: {duration}s</span>;
                  })()}
              </div>
            )}
          </div>
        )}

        {/* Execution Logs (if running) - Only show in workflow mode */}
        {state.designerMode === 'workflow' &&
          state.executionState.status === 'running' &&
          state.executionState.logs.length > 0 && (
            <div className="execution-logs">
              <h3>Execution Logs</h3>
              <div className="logs-container">
                {state.executionState.logs.slice(-10).map((log) => (
                  <div
                    key={`${log.nodeId}-${log.timestamp}-${log.level}`}
                    className={`log-entry ${log.level}`}
                  >
                    <span className="log-timestamp">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="log-node">{log.nodeId}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </>
    );
  };

  return (
    <div className={`workflow-designer ${className}`}>
      {/* Notifications */}
      {notification && (
        <Notification notification={notification} onClose={() => setNotification(null)} />
      )}

      {/* Header */}
  <HeaderSection />

      {/* Main Content */}
      <div className="workflow-designer-content">
        {/* Node Palette - Different based on mode */}
        {renderNodePaletteSection()}

        {/* Canvas Container - Shared for both modes */}
        <div
          ref={containerRef}
          className={`canvas-container ${state.uiState.isDragOver ? 'drag-over' : ''} ${state.designerMode === 'architecture' ? 'architecture-mode' : 'workflow-mode'}`}
          role="button"
          tabIndex={0}
          aria-label="Workflow canvas"
          onClick={handlers.handleCanvasClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // Use keyboard-safe internal click handler (no MouseEvent required)
              handlers.handleCanvasClickInternal();
            }
          }}
          onTouchEnd={() => {
            // Touch interaction parity with click
            handlers.handleCanvasClickInternal();
          }}
          onDragOver={handlers.handleCanvasDragOver}
          onDragLeave={handlers.handleCanvasDragLeave}
          onDrop={handlers.handleCanvasDrop}
        >
          <svg
            ref={svgRef}
            className={`workflow-canvas ${state.designerMode}-canvas ${state.connectionState.isConnecting ? 'connecting' : ''}`}
            width="100%"
            height="100%"
          >
            <WorkflowCanvas
              svgRef={svgRef}
              nodes={state.nodes}
              connections={state.connections}
              showGrid={state.uiState.showGrid}
              canvasTransform={state.canvasTransform}
              nodeVariant={state.uiState.nodeVariant}
              selectedNodes={state.selectedNodes}
              selectedConnection={state.connectionState.selectedConnection}
              isNodeSelected={(nodeId: string) => state.selectedNodes.has(nodeId)}
              isConnecting={state.connectionState.isConnecting}
              connectionStart={state.connectionState.connectionStart}
              connectionPreview={state.connectionState.connectionPreview}
              onNodeClick={handlers.handleNodeClick}
              onNodeDoubleClick={handlers.handleNodeDoubleClick}
              onNodeDrag={handlers.handleNodeDrag}
              onConnectionClick={handlers.handleConnectionClick}
              onPortClick={handlers.handlePortClick}
              onCanvasClick={handlers.handleCanvasClickInternal}
              onCanvasMouseMove={handlers.handleCanvasMouseMove}
              onPortDragStart={handlers.handlePortDragStart}
              onPortDrag={handlers.handlePortDrag}
              onPortDragEnd={handlers.handlePortDragEnd}
              canDropOnPort={canDropOnPort}
              canDropOnNode={canDropOnNode}
              onPlusButtonClick={handlePlusClick}
              onTransformChange={handlers.handleTransformChange}
              onZoomLevelChange={handlers.handleZoomLevelChange}
              onRegisterZoomBehavior={canvas.registerZoomBehavior}
            />
          </svg>

          {/* Canvas Toolbar */}
          <CanvasToolbar
            zoomLevel={state.canvasTransform.k || 1}
            showGrid={state.uiState.showGrid}
            onToggleGrid={operations.toggleGrid}
            onZoomIn={canvas.zoomIn}
            onZoomOut={canvas.zoomOut}
            onFitToScreen={() => canvas.fitToScreen(state.nodes)}
            onResetPosition={() => canvas.resetCanvasPosition(state.nodes)}
            {...(state.designerMode === 'workflow' && {
              executionStatus:
                state.executionState.status === 'paused' ? 'idle' : state.executionState.status,
            })}
            selectedNodeCount={state.selectedNodes.size}
            onDeleteSelected={
              state.selectedNodes.size > 0
                ? () => {
                    Array.from(state.selectedNodes).forEach((nodeId) => {
                      operations.deleteNode(nodeId);
                    });
                    operations.clearSelection();
                  }
                : undefined
            }
          />
        </div>

        {/* Node Editor - Only show in workflow mode */}
        {renderNodeEditorSection()}
      </div>

      {/* Status Bar */}
  <FooterSection />

      {/* Draft Manager */}
      <DraftManager isOpen={showDraftManager} onClose={() => setShowDraftManager(false)} />
    </div>
  );
}

// Notification component props interface
interface NotificationProps {
  readonly notification: {
    readonly type: 'success' | 'error';
    readonly message: string;
  };
  readonly onClose: () => void;
}

// Notification component
function Notification({ notification, onClose }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification notification-${notification.type}`}>
      {notification.message}
      <button onClick={onClose} className="notification-close">
        ×
      </button>
    </div>
  );
}

export default function WorkflowDesigner({
  initialWorkflow,
  onSave,
  onExecute,
  onExport,
  onImport,
  className = '',
  showToolbar = true,
  showNodePalette = true,
  showStatusBar = true,
  readOnly = false,
}: WorkflowDesignerProps) {
  return (
    <WorkflowProvider initialWorkflow={initialWorkflow}>
      <WorkflowDesignerContent
        onSave={onSave}
        onExecute={onExecute}
        onExport={onExport}
        onImport={onImport}
        className={className}
        showToolbar={showToolbar}
        showNodePalette={showNodePalette}
        showStatusBar={showStatusBar}
        readOnly={readOnly}
      />
    </WorkflowProvider>
  );
}
