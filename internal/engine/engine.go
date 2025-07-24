package engine

import (
	"context"
	"fmt"
	"sync"
	"time"

	"workflow-engine/internal/models"
	"workflow-engine/internal/storage"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

type Engine struct {
	db           *storage.DB
	redis        *storage.RedisClient
	nodeRegistry *NodeRegistry
	executors    map[string]*Executor
	queue        *WorkQueue
	metrics      *Metrics
	logger       *logrus.Logger
	mu           sync.RWMutex
	config       *Config
}

type Config struct {
	MaxConcurrentWorkflows int
	DefaultTimeout         time.Duration
	EnableMetrics          bool
	EnableTracing          bool
}

type Option func(*Engine)

func WithDatabase(db *storage.DB) Option {
	return func(e *Engine) {
		e.db = db
	}
}

func WithRedis(redis *storage.RedisClient) Option {
	return func(e *Engine) {
		e.redis = redis
	}
}

func WithConfig(config *Config) Option {
	return func(e *Engine) {
		e.config = config
	}
}

func WithLogger(logger *logrus.Logger) Option {
	return func(e *Engine) {
		e.logger = logger
	}
}

// NewEngine creates a new workflow engine instance
func NewEngine(db *storage.DB, redis *storage.RedisClient) *Engine {
	engine := &Engine{
		db:           db,
		redis:        redis,
		nodeRegistry: NewNodeRegistry(),
		executors:    make(map[string]*Executor),
		queue:        NewWorkQueue(redis),
		metrics:      NewMetrics(),
		logger:       logrus.New(),
		config: &Config{
			MaxConcurrentWorkflows: 100,
			DefaultTimeout:         30 * time.Minute,
			EnableMetrics:          true,
			EnableTracing:          false,
		},
	}

	// Register default metrics with error handling
	if engine.config.EnableMetrics {
		metrics := engine.metrics
		if metrics.WorkflowsTotal != nil {
			if err := prometheus.Register(metrics.WorkflowsTotal); err != nil {
				// Already registered, ignore
			}
		}
		if metrics.WorkflowDuration != nil {
			if err := prometheus.Register(metrics.WorkflowDuration); err != nil {
				// Already registered, ignore
			}
		}
		if metrics.NodeExecutionDuration != nil {
			if err := prometheus.Register(metrics.NodeExecutionDuration); err != nil {
				// Already registered, ignore
			}
		}
		if metrics.ActiveWorkflows != nil {
			if err := prometheus.Register(metrics.ActiveWorkflows); err != nil {
				// Already registered, ignore
			}
		}
	}

	return engine
}

// Execute executes a workflow with given input
func (e *Engine) Execute(ctx context.Context, workflowID string, input map[string]interface{}) (*models.Execution, error) {
	// Parse workflow ID
	wfID, err := uuid.Parse(workflowID)
	if err != nil {
		return nil, fmt.Errorf("invalid workflow ID: %w", err)
	}

	// Create execution record
	execution := &models.Execution{
		ID:         uuid.New(),
		WorkflowID: wfID,
		Status:     models.ExecutionStatusRunning,
		Input:      input,
		StartedAt:  time.Now(),
	}

	if err := e.db.CreateExecution(ctx, execution); err != nil {
		return nil, fmt.Errorf("failed to create execution: %w", err)
	}

	// Get workflow
	workflow, err := e.db.GetWorkflow(ctx, wfID)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow: %w", err)
	}

	// Create execution context
	executionCtx := &models.ExecutionContext{
		Variables: input,
	}

	// Create executor
	executor := NewExecutor(e.nodeRegistry, e.metrics, e.logger)

	// Store executor
	e.mu.Lock()
	e.executors[execution.ID.String()] = executor
	e.mu.Unlock()

	// Execute workflow
	result, err := executor.ExecuteWorkflow(ctx, workflow, executionCtx)

	// Update execution record
	execution.Status = models.ExecutionStatusCompleted
	completedAt := time.Now()
	execution.CompletedAt = &completedAt

	if err != nil {
		execution.Status = models.ExecutionStatusFailed
		errStr := err.Error()
		execution.Error = &errStr
	} else {
		execution.Output = result
	}

	if err := e.db.UpdateExecution(ctx, execution); err != nil {
		e.logger.Errorf("Failed to update execution: %v", err)
	}

	// Clean up executor
	e.mu.Lock()
	delete(e.executors, execution.ID.String())
	e.mu.Unlock()

	return execution, err
}

// RegisterNode registers a node type with the engine
func (e *Engine) RegisterNode(nodeType string, node NodeType) {
	e.nodeRegistry.Register(nodeType, node)
}

// GetAvailableNodes returns all registered node types
func (e *Engine) GetAvailableNodes() map[string]NodeType {
	return e.nodeRegistry.List()
}

// GetNodeSchema returns the schema for a specific node type
func (e *Engine) GetNodeSchema(nodeType string) (interface{}, error) {
	node, err := e.nodeRegistry.Get(nodeType)
	if err != nil {
		return nil, fmt.Errorf("node type %s not found: %w", nodeType, err)
	}

	// Return basic schema - could be enhanced with JSON schema
	return map[string]interface{}{
		"type":        nodeType,
		"name":        node.Name(),
		"description": node.Description(),
		"category":    node.Category(),
		"icon":        node.Icon(),
		"inputs":      map[string]interface{}{}, // placeholder
		"outputs":     map[string]interface{}{}, // placeholder
	}, nil
}

// StartWorker starts the background worker for processing queued workflows
func (e *Engine) StartWorker(ctx context.Context) error {
	e.logger.Info("Starting workflow engine worker")

	for {
		select {
		case <-ctx.Done():
			e.logger.Info("Worker stopped")
			return ctx.Err()
		default:
			// Process next job from queue
			job, err := e.queue.Dequeue(ctx)
			if err != nil {
				e.logger.Errorf("Failed to dequeue job: %v", err)
				time.Sleep(time.Second)
				continue
			}

			if job != nil {
				go e.processJob(ctx, job)
			} else {
				// No jobs available, wait a bit
				time.Sleep(100 * time.Millisecond)
			}
		}
	}
}

// processJob processes a single workflow job
func (e *Engine) processJob(ctx context.Context, job *Job) {
	e.logger.Infof("Processing job %s for workflow %s", job.ID, job.WorkflowID)

	_, err := e.Execute(ctx, job.WorkflowID, job.Input)
	if err != nil {
		e.logger.Errorf("Failed to execute workflow %s: %v", job.WorkflowID, err)
	}
}
