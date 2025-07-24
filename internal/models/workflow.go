package models

import (
	"time"

	"github.com/google/uuid"
)

// Workflow represents a workflow definition
type Workflow struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	Name        string                 `json:"name" db:"name"`
	Description string                 `json:"description" db:"description"`
	Definition  WorkflowDefinition     `json:"definition" db:"definition"`
	UserID      uuid.UUID              `json:"user_id" db:"user_id"`
	IsActive    bool                   `json:"is_active" db:"is_active"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
	Tags        []string               `json:"tags" db:"tags"`
	Version     int                    `json:"version" db:"version"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
}

// WorkflowDefinition contains the workflow structure
type WorkflowDefinition struct {
	Nodes       []Node                 `json:"nodes"`
	Edges       []Edge                 `json:"edges"`
	Variables   map[string]interface{} `json:"variables"`
	Settings    WorkflowSettings       `json:"settings"`
	StartNodeID string                 `json:"start_node_id"`
}

// Node represents a workflow node
type Node struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Name        string                 `json:"name"`
	Position    Position               `json:"position"`
	Config      map[string]interface{} `json:"config"`
	Inputs      []NodeInput            `json:"inputs"`
	Outputs     []NodeOutput           `json:"outputs"`
	Disabled    bool                   `json:"disabled"`
	Description string                 `json:"description"`
}

// Position represents node position in the designer
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// NodeInput represents a node input port
type NodeInput struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

// NodeOutput represents a node output port
type NodeOutput struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// Edge represents a connection between nodes
type Edge struct {
	ID         string            `json:"id"`
	Source     string            `json:"source"`
	Target     string            `json:"target"`
	SourcePort string            `json:"source_port"`
	TargetPort string            `json:"target_port"`
	Condition  *EdgeCondition    `json:"condition,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// EdgeCondition represents conditional flow
type EdgeCondition struct {
	Type       string      `json:"type"` // "expression", "value"
	Expression string      `json:"expression,omitempty"`
	Value      interface{} `json:"value,omitempty"`
	Operator   string      `json:"operator,omitempty"`
	Field      string      `json:"field,omitempty"`
}

// WorkflowSettings contains workflow-specific settings
type WorkflowSettings struct {
	Timeout          int                    `json:"timeout"` // in seconds
	RetryCount       int                    `json:"retry_count"`
	RetryDelay       int                    `json:"retry_delay"`    // in seconds
	ErrorHandling    string                 `json:"error_handling"` // "stop", "continue", "retry"
	MaxConcurrency   int                    `json:"max_concurrency"`
	SaveExecutionLog bool                   `json:"save_execution_log"`
	Variables        map[string]interface{} `json:"variables"`
}

// Execution represents a workflow execution
type Execution struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	WorkflowID  uuid.UUID              `json:"workflow_id" db:"workflow_id"`
	Status      ExecutionStatus        `json:"status" db:"status"`
	Input       map[string]interface{} `json:"input" db:"input"`
	Output      map[string]interface{} `json:"output" db:"output"`
	Error       *string                `json:"error,omitempty" db:"error"`
	StartedAt   time.Time              `json:"started_at" db:"started_at"`
	CompletedAt *time.Time             `json:"completed_at,omitempty" db:"completed_at"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
	Context     ExecutionContext       `json:"context" db:"context"`
}

// ExecutionStatus represents the status of an execution
type ExecutionStatus string

const (
	ExecutionStatusPending   ExecutionStatus = "pending"
	ExecutionStatusRunning   ExecutionStatus = "running"
	ExecutionStatusCompleted ExecutionStatus = "completed"
	ExecutionStatusFailed    ExecutionStatus = "failed"
	ExecutionStatusCancelled ExecutionStatus = "cancelled"
	ExecutionStatusPaused    ExecutionStatus = "paused"
)

// ExecutionContext contains runtime context
type ExecutionContext struct {
	Variables      map[string]interface{}   `json:"variables"`
	NodeExecutions map[string]NodeExecution `json:"node_executions"`
	CurrentNodeID  string                   `json:"current_node_id"`
	Stack          []string                 `json:"stack"`
	Logs           []LogEntry               `json:"logs"`
}

// NodeExecution represents a single node execution
type NodeExecution struct {
	NodeID      string                 `json:"node_id"`
	Status      ExecutionStatus        `json:"status"`
	Input       map[string]interface{} `json:"input"`
	Output      map[string]interface{} `json:"output"`
	Error       *string                `json:"error,omitempty"`
	StartedAt   time.Time              `json:"started_at"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	RetryCount  int                    `json:"retry_count"`
}

// LogEntry represents a log entry
type LogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"`
	NodeID    string                 `json:"node_id"`
	Message   string                 `json:"message"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// User represents a user
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	Name         string    `json:"name" db:"name"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Role         string    `json:"role" db:"role"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Schedule represents a workflow schedule
type Schedule struct {
	ID         uuid.UUID              `json:"id" db:"id"`
	WorkflowID uuid.UUID              `json:"workflow_id" db:"workflow_id"`
	Name       string                 `json:"name" db:"name"`
	CronExpr   string                 `json:"cron_expr" db:"cron_expr"`
	Timezone   string                 `json:"timezone" db:"timezone"`
	IsActive   bool                   `json:"is_active" db:"is_active"`
	NextRunAt  *time.Time             `json:"next_run_at" db:"next_run_at"`
	LastRunAt  *time.Time             `json:"last_run_at" db:"last_run_at"`
	Input      map[string]interface{} `json:"input" db:"input"`
	CreatedAt  time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at" db:"updated_at"`
}
