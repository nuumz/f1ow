package engine

import (
	"context"
	"fmt"
	"sync"
)

// NodeType represents a node implementation
type NodeType interface {
	// Execute runs the node logic
	Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error)

	// ValidateConfig validates the node configuration
	ValidateConfig(config interface{}) error

	// GetSchema returns the node configuration schema
	GetSchema() NodeSchema

	// Type returns the node type identifier
	Type() string

	// Name returns the display name of the node
	Name() string

	// Description returns the node description
	Description() string

	// Category returns the node category
	Category() string

	// Icon returns the node icon
	Icon() string
}

// NodeSchema defines the configuration schema for a node
type NodeSchema struct {
	Type       string              `json:"type"`
	Properties map[string]Property `json:"properties"`
	Required   []string            `json:"required"`
	Inputs     []PortSchema        `json:"inputs"`
	Outputs    []PortSchema        `json:"outputs"`
}

// Property defines a configuration property
type Property struct {
	Type        string      `json:"type"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Default     interface{} `json:"default,omitempty"`
	Enum        []string    `json:"enum,omitempty"`
	Format      string      `json:"format,omitempty"`
	Minimum     *float64    `json:"minimum,omitempty"`
	Maximum     *float64    `json:"maximum,omitempty"`
}

// PortSchema defines an input or output port
type PortSchema struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
	Multiple    bool   `json:"multiple"` // Can accept multiple connections
}

// NodeRegistry manages available node types
type NodeRegistry struct {
	nodes map[string]NodeType
	mu    sync.RWMutex
}

// NewNodeRegistry creates a new node registry
func NewNodeRegistry() *NodeRegistry {
	return &NodeRegistry{
		nodes: make(map[string]NodeType),
	}
}

// Register adds a new node type to the registry
func (r *NodeRegistry) Register(nodeType string, node NodeType) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.nodes[nodeType]; exists {
		return fmt.Errorf("node type %s already registered", nodeType)
	}

	r.nodes[nodeType] = node
	return nil
}

// Get retrieves a node type from the registry
func (r *NodeRegistry) Get(nodeType string) (NodeType, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	node, exists := r.nodes[nodeType]
	if !exists {
		return nil, fmt.Errorf("node type %s not found", nodeType)
	}

	return node, nil
}

// List returns all registered node types
func (r *NodeRegistry) List() map[string]NodeType {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Create a copy to avoid race conditions
	result := make(map[string]NodeType)
	for k, v := range r.nodes {
		result[k] = v
	}

	return result
}

// GetSchema returns the schema for a specific node type
func (r *NodeRegistry) GetSchema(nodeType string) (NodeSchema, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	node, exists := r.nodes[nodeType]
	if !exists {
		return NodeSchema{}, fmt.Errorf("node type %s not found", nodeType)
	}

	return node.GetSchema(), nil
}

// Categories returns all available node categories
func (r *NodeRegistry) Categories() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	categoryMap := make(map[string]bool)
	for _, node := range r.nodes {
		categoryMap[node.Category()] = true
	}

	categories := make([]string, 0, len(categoryMap))
	for category := range categoryMap {
		categories = append(categories, category)
	}

	return categories
}
