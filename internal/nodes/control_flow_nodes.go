package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nuumz/f1ow/internal/engine"
)

// LoopNode implements iteration over arrays
type LoopNode struct {
	BaseNode
}

// LoopConfig defines configuration for loop node
type LoopConfig struct {
	ArrayPath      string                 `json:"array_path"`
	ItemVariable   string                 `json:"item_variable"`
	IndexVariable  string                 `json:"index_variable"`
	OutputArray    bool                   `json:"output_array"`
	MaxIterations  int                    `json:"max_iterations"`
	BreakCondition *Condition             `json:"break_condition"`
	ItemProcessing map[string]interface{} `json:"item_processing"`
}

// NewLoopNode creates a new loop node
func NewLoopNode() engine.NodeType {
	return &LoopNode{
		BaseNode: BaseNode{
			nodeType:    "loop",
			name:        "Loop",
			description: "Iterate over arrays and process each item",
			category:    "Control Flow",
			icon:        "repeat",
		},
	}
}

// Execute iterates over array items
func (n *LoopNode) Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error) {
	loopConfig, err := n.parseConfig(config)
	if err != nil {
		return nil, err
	}

	inputData := make(map[string]interface{})
	if inputMap, ok := input.(map[string]interface{}); ok {
		inputData = inputMap
	} else {
		inputData["data"] = input
	}

	// Get array to iterate
	arrayValue := getValueByPath(inputData, loopConfig.ArrayPath)
	array, ok := arrayValue.([]interface{})
	if !ok {
		return nil, fmt.Errorf("value at path '%s' is not an array", loopConfig.ArrayPath)
	}

	// Process items
	var results []interface{}
	maxIter := loopConfig.MaxIterations
	if maxIter == 0 {
		maxIter = len(array)
	}

	for i, item := range array {
		if i >= maxIter {
			break
		}

		// Check break condition
		if loopConfig.BreakCondition != nil {
			itemData := n.prepareItemData(inputData, item, i, loopConfig)
			shouldBreak, err := n.evaluateBreakCondition(*loopConfig.BreakCondition, itemData)
			if err != nil {
				return nil, fmt.Errorf("failed to evaluate break condition: %w", err)
			}
			if shouldBreak {
				break
			}
		}

		// Process item
		if loopConfig.ItemProcessing != nil {
			itemData := n.prepareItemData(inputData, item, i, loopConfig)
			processedItem, err := n.processItem(ctx, loopConfig.ItemProcessing, itemData)
			if err != nil {
				return nil, fmt.Errorf("failed to process item %d: %w", i, err)
			}

			if loopConfig.OutputArray {
				results = append(results, processedItem)
			}
		} else {
			if loopConfig.OutputArray {
				results = append(results, item)
			}
		}
	}

	// Prepare output
	output := make(map[string]interface{})
	for k, v := range inputData {
		output[k] = v
	}

	if loopConfig.OutputArray {
		output["results"] = results
	}
	output["iterations"] = len(results)

	return output, nil
}

// ValidateConfig validates the node configuration
func (n *LoopNode) ValidateConfig(config interface{}) error {
	loopConfig, err := n.parseConfig(config)
	if err != nil {
		return err
	}

	if loopConfig.ArrayPath == "" {
		return fmt.Errorf("array_path is required")
	}

	if loopConfig.ItemVariable == "" {
		loopConfig.ItemVariable = "item"
	}

	if loopConfig.IndexVariable == "" {
		loopConfig.IndexVariable = "index"
	}

	return nil
}

// GetSchema returns the node configuration schema
func (n *LoopNode) GetSchema() engine.NodeSchema {
	return engine.NodeSchema{
		Type: "object",
		Properties: map[string]engine.Property{
			"array_path": {
				Type:        "string",
				Title:       "Array Path",
				Description: "Path to the array to iterate over (e.g., 'data.items')",
			},
			"item_variable": {
				Type:        "string",
				Title:       "Item Variable",
				Description: "Name of the variable containing current item",
				Default:     "item",
			},
			"index_variable": {
				Type:        "string",
				Title:       "Index Variable",
				Description: "Name of the variable containing current index",
				Default:     "index",
			},
			"output_array": {
				Type:        "boolean",
				Title:       "Output Array",
				Description: "Whether to collect results in an array",
				Default:     true,
			},
			"max_iterations": {
				Type:        "number",
				Title:       "Max Iterations",
				Description: "Maximum number of iterations (0 = no limit)",
				Default:     0,
			},
			"break_condition": {
				Type:        "object",
				Title:       "Break Condition",
				Description: "Condition to break the loop early",
			},
			"item_processing": {
				Type:        "object",
				Title:       "Item Processing",
				Description: "Processing configuration for each item",
			},
		},
		Required: []string{"array_path"},
		Inputs: []engine.PortSchema{
			{
				Name:        "input",
				Type:        "object",
				Description: "Input data containing array to iterate",
				Required:    true,
			},
		},
		Outputs: []engine.PortSchema{
			{
				Name:        "output",
				Type:        "object",
				Description: "Results of loop processing",
				Required:    true,
			},
		},
	}
}

// parseConfig parses the node configuration
func (n *LoopNode) parseConfig(config interface{}) (*LoopConfig, error) {
	configMap, ok := config.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid config type for loop node")
	}

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var loopConfig LoopConfig
	if err := json.Unmarshal(configJSON, &loopConfig); err != nil {
		return nil, fmt.Errorf("failed to parse loop config: %w", err)
	}

	// Set defaults
	if loopConfig.ItemVariable == "" {
		loopConfig.ItemVariable = "item"
	}
	if loopConfig.IndexVariable == "" {
		loopConfig.IndexVariable = "index"
	}

	return &loopConfig, nil
}

// prepareItemData prepares data for each iteration
func (n *LoopNode) prepareItemData(inputData map[string]interface{}, item interface{}, index int, config *LoopConfig) map[string]interface{} {
	itemData := make(map[string]interface{})

	// Copy original data
	for k, v := range inputData {
		itemData[k] = v
	}

	// Add loop variables
	itemData[config.ItemVariable] = item
	itemData[config.IndexVariable] = index

	return itemData
}

// processItem processes a single item
func (n *LoopNode) processItem(ctx context.Context, processing map[string]interface{}, itemData map[string]interface{}) (interface{}, error) {
	// This is a simplified implementation
	// In a real implementation, you might execute a sub-workflow or transformation

	if code, ok := processing["code"].(string); ok {
		// Execute JavaScript code for item processing
		return n.executeJavaScript(code, itemData)
	}

	if transform, ok := processing["transform"].(map[string]interface{}); ok {
		// Apply transformation
		return n.applyTransform(transform, itemData)
	}

	// Return processed item data
	return itemData, nil
}

// executeJavaScript executes JavaScript code (simplified)
func (n *LoopNode) executeJavaScript(code string, data map[string]interface{}) (interface{}, error) {
	// TODO: Implement using goja VM
	// For now, return the data
	return data, nil
}

// applyTransform applies transformation rules
func (n *LoopNode) applyTransform(transform map[string]interface{}, data map[string]interface{}) (interface{}, error) {
	result := make(map[string]interface{})

	for key, rule := range transform {
		if path, ok := rule.(string); ok {
			result[key] = getValueByPath(data, path)
		} else {
			result[key] = rule
		}
	}

	return result, nil
}

// evaluateBreakCondition evaluates break condition
func (n *LoopNode) evaluateBreakCondition(condition Condition, data map[string]interface{}) (bool, error) {
	// Reuse condition evaluation from conditional node
	conditionalNode := &ConditionalNode{}
	return conditionalNode.evaluateCondition(condition, data)
}

// ParallelNode implements parallel execution
type ParallelNode struct {
	BaseNode
}

// ParallelConfig defines configuration for parallel node
type ParallelConfig struct {
	Branches        []Branch `json:"branches"`
	WaitStrategy    string   `json:"wait_strategy"` // "all", "any", "first"
	TimeoutSeconds  int      `json:"timeout_seconds"`
	FailureStrategy string   `json:"failure_strategy"` // "fail_fast", "continue", "ignore"
}

// Branch represents a parallel execution branch
type Branch struct {
	Name       string                 `json:"name"`
	Input      map[string]interface{} `json:"input"`
	Processing map[string]interface{} `json:"processing"`
}

// NewParallelNode creates a new parallel node
func NewParallelNode() engine.NodeType {
	return &ParallelNode{
		BaseNode: BaseNode{
			nodeType:    "parallel",
			name:        "Parallel",
			description: "Execute multiple branches in parallel",
			category:    "Control Flow",
			icon:        "git-merge",
		},
	}
}

// Execute runs branches in parallel
func (n *ParallelNode) Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error) {
	parallelConfig, err := n.parseConfig(config)
	if err != nil {
		return nil, err
	}

	inputData := make(map[string]interface{})
	if inputMap, ok := input.(map[string]interface{}); ok {
		inputData = inputMap
	} else {
		inputData["data"] = input
	}

	// Create context with timeout if specified
	if parallelConfig.TimeoutSeconds > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(parallelConfig.TimeoutSeconds)*time.Second)
		defer cancel()
	}

	// Execute branches in parallel
	type branchResult struct {
		name   string
		result interface{}
		err    error
	}

	resultChan := make(chan branchResult, len(parallelConfig.Branches))
	var wg sync.WaitGroup

	for _, branch := range parallelConfig.Branches {
		wg.Add(1)
		go func(b Branch) {
			defer wg.Done()

			// Prepare branch input
			branchInput := make(map[string]interface{})
			for k, v := range inputData {
				branchInput[k] = v
			}
			for k, v := range b.Input {
				branchInput[k] = interpolateValue(v, inputData)
			}

			// Execute branch
			result, err := n.executeBranch(ctx, b.Processing, branchInput)
			resultChan <- branchResult{
				name:   b.Name,
				result: result,
				err:    err,
			}
		}(branch)
	}

	// Wait for completion based on strategy
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	results := make(map[string]interface{})
	errors := make(map[string]string)
	completed := 0

	for result := range resultChan {
		completed++

		if result.err != nil {
			errors[result.name] = result.err.Error()

			if parallelConfig.FailureStrategy == "fail_fast" {
				return nil, fmt.Errorf("branch '%s' failed: %w", result.name, result.err)
			}
		} else {
			results[result.name] = result.result
		}

		// Check wait strategy
		switch parallelConfig.WaitStrategy {
		case "any":
			if len(results) > 0 {
				goto done
			}
		case "first":
			if completed == 1 && result.err == nil {
				goto done
			}
		}
	}

done:
	output := make(map[string]interface{})
	for k, v := range inputData {
		output[k] = v
	}
	output["results"] = results
	output["completed"] = completed
	output["total"] = len(parallelConfig.Branches)

	if len(errors) > 0 {
		output["errors"] = errors
	}

	return output, nil
}

// ValidateConfig validates the node configuration
func (n *ParallelNode) ValidateConfig(config interface{}) error {
	parallelConfig, err := n.parseConfig(config)
	if err != nil {
		return err
	}

	if len(parallelConfig.Branches) == 0 {
		return fmt.Errorf("at least one branch is required")
	}

	validWaitStrategies := map[string]bool{
		"all": true, "any": true, "first": true,
	}

	if parallelConfig.WaitStrategy != "" && !validWaitStrategies[parallelConfig.WaitStrategy] {
		return fmt.Errorf("invalid wait strategy: %s", parallelConfig.WaitStrategy)
	}

	return nil
}

// GetSchema returns the node configuration schema
func (n *ParallelNode) GetSchema() engine.NodeSchema {
	return engine.NodeSchema{
		Type: "object",
		Properties: map[string]engine.Property{
			"branches": {
				Type:        "array",
				Title:       "Branches",
				Description: "List of branches to execute in parallel",
			},
			"wait_strategy": {
				Type:        "string",
				Title:       "Wait Strategy",
				Description: "When to complete execution",
				Default:     "all",
				Enum:        []string{"all", "any", "first"},
			},
			"timeout_seconds": {
				Type:        "number",
				Title:       "Timeout",
				Description: "Timeout in seconds for all branches",
				Default:     0,
			},
			"failure_strategy": {
				Type:        "string",
				Title:       "Failure Strategy",
				Description: "How to handle branch failures",
				Default:     "continue",
				Enum:        []string{"fail_fast", "continue", "ignore"},
			},
		},
		Required: []string{"branches"},
		Inputs: []engine.PortSchema{
			{
				Name:        "input",
				Type:        "any",
				Description: "Input data for all branches",
				Required:    false,
			},
		},
		Outputs: []engine.PortSchema{
			{
				Name:        "output",
				Type:        "object",
				Description: "Results from all branches",
				Required:    true,
			},
		},
	}
}

// parseConfig parses the node configuration
func (n *ParallelNode) parseConfig(config interface{}) (*ParallelConfig, error) {
	configMap, ok := config.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid config type for parallel node")
	}

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var parallelConfig ParallelConfig
	if err := json.Unmarshal(configJSON, &parallelConfig); err != nil {
		return nil, fmt.Errorf("failed to parse parallel config: %w", err)
	}

	// Set defaults
	if parallelConfig.WaitStrategy == "" {
		parallelConfig.WaitStrategy = "all"
	}
	if parallelConfig.FailureStrategy == "" {
		parallelConfig.FailureStrategy = "continue"
	}

	return &parallelConfig, nil
}

// executeBranch executes a single branch
func (n *ParallelNode) executeBranch(ctx context.Context, processing map[string]interface{}, input map[string]interface{}) (interface{}, error) {
	// Simplified branch execution
	// In a real implementation, this might execute a sub-workflow

	if code, ok := processing["code"].(string); ok {
		// Execute JavaScript code
		return n.executeJavaScript(code, input)
	}

	if transform, ok := processing["transform"].(map[string]interface{}); ok {
		// Apply transformation
		return n.applyTransform(transform, input)
	}

	// Return input if no processing specified
	return input, nil
}

// Helper methods (same as LoopNode)
func (n *ParallelNode) executeJavaScript(code string, data map[string]interface{}) (interface{}, error) {
	// TODO: Implement using goja VM
	return data, nil
}

func (n *ParallelNode) applyTransform(transform map[string]interface{}, data map[string]interface{}) (interface{}, error) {
	result := make(map[string]interface{})

	for key, rule := range transform {
		if path, ok := rule.(string); ok {
			result[key] = getValueByPath(data, path)
		} else {
			result[key] = rule
		}
	}

	return result, nil
}
