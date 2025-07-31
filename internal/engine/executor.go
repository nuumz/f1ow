package engine

import (
	"context"
	"fmt"
	"time"

	"github.com/nuumz/f1ow/internal/models"

	"github.com/sirupsen/logrus"
)

// Executor handles the execution of a workflow
type Executor struct {
	nodeRegistry *NodeRegistry
	metrics      *Metrics
	logger       *logrus.Logger
}

// NewExecutor creates a new workflow executor
func NewExecutor(nodeRegistry *NodeRegistry, metrics *Metrics, logger *logrus.Logger) *Executor {
	return &Executor{
		nodeRegistry: nodeRegistry,
		metrics:      metrics,
		logger:       logger,
	}
}

// ExecuteWorkflow executes a complete workflow
func (e *Executor) ExecuteWorkflow(ctx context.Context, workflow *models.Workflow, executionCtx *models.ExecutionContext) (map[string]interface{}, error) {
	e.logger.Infof("Starting execution of workflow %s", workflow.ID)

	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime)
		e.metrics.RecordWorkflowExecution(duration, true) // TODO: pass actual success status
	}()

	// Initialize node outputs if not provided
	if executionCtx.NodeExecutions == nil {
		executionCtx.NodeExecutions = make(map[string]models.NodeExecution)
	}

	// Parse workflow definition
	workflowDef := workflow.Definition

	// Execute nodes based on DAG order
	result, err := e.executeDAG(ctx, &workflowDef, executionCtx)
	if err != nil {
		e.logger.Errorf("Workflow execution failed: %v", err)
		return nil, err
	}

	e.logger.Infof("Workflow %s completed successfully", workflow.ID)
	return result, nil
}

// executeDAG executes workflow nodes in dependency order
func (e *Executor) executeDAG(ctx context.Context, workflowDef *models.WorkflowDefinition, executionCtx *models.ExecutionContext) (map[string]interface{}, error) {
	// Build dependency graph
	dependencies := e.buildDependencyGraph(workflowDef)

	// Topological sort to determine execution order
	executionOrder, err := e.topologicalSort(workflowDef.Nodes, dependencies)
	if err != nil {
		return nil, fmt.Errorf("failed to determine execution order: %w", err)
	}

	// Execute nodes in order
	for _, nodeID := range executionOrder {
		node := e.findNodeByID(workflowDef.Nodes, nodeID)
		if node == nil {
			return nil, fmt.Errorf("node %s not found", nodeID)
		}

		// Check if node should be executed based on conditions
		shouldExecute := e.evaluateNodeConditions(node, executionCtx)
		if !shouldExecute {
			e.logger.Infof("Skipping node %s due to conditions", nodeID)
			continue
		}

		// Execute the node
		output, err := e.executeNode(ctx, node, executionCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to execute node %s: %w", nodeID, err)
		}

		// Store node output for subsequent nodes
		if nodeExecution, exists := executionCtx.NodeExecutions[nodeID]; exists {
			nodeExecution.Output = output.(map[string]interface{})
			executionCtx.NodeExecutions[nodeID] = nodeExecution
		} else {
			executionCtx.NodeExecutions[nodeID] = models.NodeExecution{
				NodeID: nodeID,
				Output: output.(map[string]interface{}),
			}
		}
		executionCtx.CurrentNodeID = nodeID
	}

	// Return final outputs - convert node executions to outputs
	outputs := make(map[string]interface{})
	for nodeID, nodeExec := range executionCtx.NodeExecutions {
		outputs[nodeID] = nodeExec.Output
	}
	return outputs, nil
}

// executeNode executes a single workflow node
func (e *Executor) executeNode(ctx context.Context, node *models.Node, executionCtx *models.ExecutionContext) (interface{}, error) {
	e.logger.Infof("Executing node %s of type %s", node.ID, node.Type)

	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime)
		e.metrics.RecordNodeExecution(node.Type, duration)
	}()

	// Get node implementation
	nodeImpl, err := e.nodeRegistry.Get(node.Type)
	if err != nil {
		return nil, fmt.Errorf("node type %s not registered: %w", node.Type, err)
	}

	// Prepare node input from previous node outputs and workflow variables
	input := e.prepareNodeInput(node, executionCtx)

	// Execute the node
	output, err := nodeImpl.Execute(ctx, input, node.Config)
	if err != nil {
		return nil, fmt.Errorf("node execution failed: %w", err)
	}

	return output, nil
}

// prepareNodeInput prepares input data for a node execution
func (e *Executor) prepareNodeInput(node *models.Node, executionCtx *models.ExecutionContext) map[string]interface{} {
	input := make(map[string]interface{})

	// Add workflow variables
	for k, v := range executionCtx.Variables {
		input[k] = v
	}

	// Add outputs from previous nodes
	nodeOutputs := make(map[string]interface{})
	for nodeID, nodeExec := range executionCtx.NodeExecutions {
		nodeOutputs[nodeID] = nodeExec.Output
	}
	input["nodeOutputs"] = nodeOutputs

	return input
}

// buildDependencyGraph builds a dependency graph from workflow edges
func (e *Executor) buildDependencyGraph(workflowDef *models.WorkflowDefinition) map[string][]string {
	dependencies := make(map[string][]string)

	// Initialize all nodes
	for _, node := range workflowDef.Nodes {
		dependencies[node.ID] = []string{}
	}

	// Add dependencies based on edges
	for _, edge := range workflowDef.Edges {
		dependencies[edge.Target] = append(dependencies[edge.Target], edge.Source)
	}

	return dependencies
}

// topologicalSort performs topological sorting on the nodes
func (e *Executor) topologicalSort(nodes []models.Node, dependencies map[string][]string) ([]string, error) {
	var result []string
	visited := make(map[string]bool)
	visiting := make(map[string]bool)

	var visit func(string) error
	visit = func(nodeID string) error {
		if visiting[nodeID] {
			return fmt.Errorf("circular dependency detected")
		}
		if visited[nodeID] {
			return nil
		}

		visiting[nodeID] = true

		for _, depID := range dependencies[nodeID] {
			if err := visit(depID); err != nil {
				return err
			}
		}

		visiting[nodeID] = false
		visited[nodeID] = true
		result = append(result, nodeID)

		return nil
	}

	for _, node := range nodes {
		if !visited[node.ID] {
			if err := visit(node.ID); err != nil {
				return nil, err
			}
		}
	}

	// Reverse the result to get correct execution order
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result, nil
}

// findNodeByID finds a node by its ID
func (e *Executor) findNodeByID(nodes []models.Node, nodeID string) *models.Node {
	for i, node := range nodes {
		if node.ID == nodeID {
			return &nodes[i]
		}
	}
	return nil
}

// evaluateNodeConditions evaluates whether a node should be executed
func (e *Executor) evaluateNodeConditions(node *models.Node, executionCtx *models.ExecutionContext) bool {
	// Simple condition evaluation - can be enhanced
	if config, ok := node.Config["condition"]; ok {
		if condition, ok := config.(map[string]interface{}); ok {
			if enabled, ok := condition["enabled"].(bool); ok {
				return enabled
			}
		}
	}

	// Default to execute if no conditions specified
	return true
}
