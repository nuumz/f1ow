package engine_test

import (
	"context"
	"testing"

	"github.com/nuumz/f1ow/internal/engine"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockNode implements engine.NodeType interface for testing
type MockNode struct {
	mock.Mock
}

func (m *MockNode) Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error) {
	args := m.Called(ctx, config, input)
	return args.Get(0), args.Error(1)
}

func (m *MockNode) ValidateConfig(config interface{}) error {
	args := m.Called(config)
	return args.Error(0)
}

func (m *MockNode) GetSchema() engine.NodeSchema {
	args := m.Called()
	return args.Get(0).(engine.NodeSchema)
}

func (m *MockNode) Type() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockNode) Name() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockNode) Description() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockNode) Category() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockNode) Icon() string {
	args := m.Called()
	return args.String(0)
}

func TestNodeRegistry_Register(t *testing.T) {
	registry := engine.NewNodeRegistry()
	mockNode := &MockNode{}

	// Register the node without expectations since Register doesn't call node methods
	err := registry.Register("test", mockNode)

	assert.NoError(t, err)
}

func TestNodeRegistry_Get(t *testing.T) {
	registry := engine.NewNodeRegistry()
	mockNode := &MockNode{}

	// Register the node
	err := registry.Register("test", mockNode)
	assert.NoError(t, err)

	// Get the node
	retrievedNode, err := registry.Get("test")

	assert.NoError(t, err)
	assert.Equal(t, mockNode, retrievedNode)
}

func TestNodeRegistry_Categories(t *testing.T) {
	registry := engine.NewNodeRegistry()
	mockNode1 := &MockNode{}
	mockNode2 := &MockNode{}

	// Setup mock expectations - Categories() calls Category() on each registered node
	mockNode1.On("Category").Return("category1")
	mockNode2.On("Category").Return("category2")

	// Register nodes
	err := registry.Register("test1", mockNode1)
	assert.NoError(t, err)
	err = registry.Register("test2", mockNode2)
	assert.NoError(t, err)

	// Get categories
	categories := registry.Categories()

	assert.Contains(t, categories, "category1")
	assert.Contains(t, categories, "category2")
	assert.Len(t, categories, 2)

	mockNode1.AssertExpectations(t)
	mockNode2.AssertExpectations(t)
}
