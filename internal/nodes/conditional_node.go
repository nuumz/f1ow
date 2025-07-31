package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nuumz/f1ow/internal/engine"
)

// ConditionalNode implements if/then/else logic
type ConditionalNode struct {
	BaseNode
}

// ConditionalConfig defines configuration for conditional node
type ConditionalConfig struct {
	Conditions    []Condition `json:"conditions"`
	DefaultOutput interface{} `json:"default_output"`
	OutputPath    string      `json:"output_path"`
}

// Condition represents a single condition
type Condition struct {
	Field      string      `json:"field"`
	Operator   string      `json:"operator"`
	Value      interface{} `json:"value"`
	Output     interface{} `json:"output"`
	Expression string      `json:"expression"` // Alternative to field/operator/value
}

// NewConditionalNode creates a new conditional node
func NewConditionalNode() engine.NodeType {
	return &ConditionalNode{
		BaseNode: BaseNode{
			nodeType:    "conditional",
			name:        "Conditional",
			description: "Execute conditional logic (if/then/else)",
			category:    "Control Flow",
			icon:        "git-branch",
		},
	}
}

// Execute evaluates conditions and returns appropriate output
func (n *ConditionalNode) Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error) {
	conditionalConfig, err := n.parseConfig(config)
	if err != nil {
		return nil, err
	}

	inputData := make(map[string]interface{})
	if inputMap, ok := input.(map[string]interface{}); ok {
		inputData = inputMap
	} else {
		inputData["data"] = input
	}

	// Evaluate conditions in order
	for _, condition := range conditionalConfig.Conditions {
		matched, err := n.evaluateCondition(condition, inputData)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate condition: %w", err)
		}

		if matched {
			output := condition.Output
			if conditionalConfig.OutputPath != "" {
				return n.setOutputPath(inputData, conditionalConfig.OutputPath, output), nil
			}
			return output, nil
		}
	}

	// No condition matched, return default
	if conditionalConfig.DefaultOutput != nil {
		output := conditionalConfig.DefaultOutput
		if conditionalConfig.OutputPath != "" {
			return n.setOutputPath(inputData, conditionalConfig.OutputPath, output), nil
		}
		return output, nil
	}

	// Return original input if no default specified
	return input, nil
}

// ValidateConfig validates the node configuration
func (n *ConditionalNode) ValidateConfig(config interface{}) error {
	conditionalConfig, err := n.parseConfig(config)
	if err != nil {
		return err
	}

	if len(conditionalConfig.Conditions) == 0 {
		return fmt.Errorf("at least one condition is required")
	}

	for i, condition := range conditionalConfig.Conditions {
		if condition.Expression == "" {
			if condition.Field == "" {
				return fmt.Errorf("condition %d: field is required when expression is not used", i)
			}
			if condition.Operator == "" {
				return fmt.Errorf("condition %d: operator is required when expression is not used", i)
			}
		}
	}

	return nil
}

// GetSchema returns the node configuration schema
func (n *ConditionalNode) GetSchema() engine.NodeSchema {
	return engine.NodeSchema{
		Type: "object",
		Properties: map[string]engine.Property{
			"conditions": {
				Type:        "array",
				Title:       "Conditions",
				Description: "List of conditions to evaluate in order",
			},
			"default_output": {
				Type:        "object",
				Title:       "Default Output",
				Description: "Output when no conditions match",
			},
			"output_path": {
				Type:        "string",
				Title:       "Output Path",
				Description: "Path to set the output in the input data (optional)",
			},
		},
		Required: []string{"conditions"},
		Inputs: []engine.PortSchema{
			{
				Name:        "input",
				Type:        "any",
				Description: "Input data to evaluate conditions against",
				Required:    false,
			},
		},
		Outputs: []engine.PortSchema{
			{
				Name:        "output",
				Type:        "any",
				Description: "Output based on matching condition",
				Required:    true,
			},
		},
	}
}

// parseConfig parses the node configuration
func (n *ConditionalNode) parseConfig(config interface{}) (*ConditionalConfig, error) {
	configMap, ok := config.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid config type for conditional node")
	}

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var conditionalConfig ConditionalConfig
	if err := json.Unmarshal(configJSON, &conditionalConfig); err != nil {
		return nil, fmt.Errorf("failed to parse conditional config: %w", err)
	}

	return &conditionalConfig, nil
}

// evaluateCondition evaluates a single condition
func (n *ConditionalNode) evaluateCondition(condition Condition, data map[string]interface{}) (bool, error) {
	if condition.Expression != "" {
		// TODO: Implement expression evaluation using goja
		return true, nil // Placeholder
	}

	// Get field value
	fieldValue := getValueByPath(data, condition.Field)

	// Evaluate operator
	switch strings.ToLower(condition.Operator) {
	case "equals", "==", "eq":
		return compareValues(fieldValue, condition.Value, "eq")
	case "not_equals", "!=", "ne":
		return compareValues(fieldValue, condition.Value, "ne")
	case "greater_than", ">", "gt":
		return compareValues(fieldValue, condition.Value, "gt")
	case "greater_than_or_equal", ">=", "gte":
		return compareValues(fieldValue, condition.Value, "gte")
	case "less_than", "<", "lt":
		return compareValues(fieldValue, condition.Value, "lt")
	case "less_than_or_equal", "<=", "lte":
		return compareValues(fieldValue, condition.Value, "lte")
	case "contains":
		return containsValue(fieldValue, condition.Value)
	case "starts_with":
		return startsWithValue(fieldValue, condition.Value)
	case "ends_with":
		return endsWithValue(fieldValue, condition.Value)
	case "exists":
		return fieldValue != nil, nil
	case "not_exists":
		return fieldValue == nil, nil
	case "in":
		return inArray(fieldValue, condition.Value)
	case "not_in":
		result, err := inArray(fieldValue, condition.Value)
		return !result, err
	default:
		return false, fmt.Errorf("unsupported operator: %s", condition.Operator)
	}
}

// setOutputPath sets a value at the specified path in the data
func (n *ConditionalNode) setOutputPath(data map[string]interface{}, path string, value interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range data {
		result[k] = v
	}

	if path == "" || path == "." {
		if valueMap, ok := value.(map[string]interface{}); ok {
			for k, v := range valueMap {
				result[k] = v
			}
		} else {
			result["result"] = value
		}
		return result
	}

	// Simple path setting - could be enhanced
	parts := strings.Split(path, ".")
	current := result

	for i, part := range parts {
		if i == len(parts)-1 {
			current[part] = value
		} else {
			if _, exists := current[part]; !exists {
				current[part] = make(map[string]interface{})
			}
			if nextMap, ok := current[part].(map[string]interface{}); ok {
				current = nextMap
			}
		}
	}

	return result
}

// Helper functions for value comparison
func compareValues(a, b interface{}, op string) (bool, error) {
	switch op {
	case "eq":
		return a == b, nil
	case "ne":
		return a != b, nil
	case "gt", "gte", "lt", "lte":
		return compareNumeric(a, b, op)
	default:
		return false, fmt.Errorf("unsupported comparison operator: %s", op)
	}
}

func compareNumeric(a, b interface{}, op string) (bool, error) {
	aFloat, aOk := toFloat64(a)
	bFloat, bOk := toFloat64(b)

	if !aOk || !bOk {
		return false, fmt.Errorf("cannot compare non-numeric values")
	}

	switch op {
	case "gt":
		return aFloat > bFloat, nil
	case "gte":
		return aFloat >= bFloat, nil
	case "lt":
		return aFloat < bFloat, nil
	case "lte":
		return aFloat <= bFloat, nil
	default:
		return false, fmt.Errorf("unknown numeric operator: %s", op)
	}
}

func containsValue(haystack, needle interface{}) (bool, error) {
	switch h := haystack.(type) {
	case string:
		if n, ok := needle.(string); ok {
			return strings.Contains(h, n), nil
		}
	case []interface{}:
		for _, item := range h {
			if item == needle {
				return true, nil
			}
		}
		return false, nil
	}
	return false, fmt.Errorf("contains operation not supported for this type")
}

func startsWithValue(haystack, needle interface{}) (bool, error) {
	h, hOk := haystack.(string)
	n, nOk := needle.(string)

	if !hOk || !nOk {
		return false, fmt.Errorf("starts_with operation requires string values")
	}

	return strings.HasPrefix(h, n), nil
}

func endsWithValue(haystack, needle interface{}) (bool, error) {
	h, hOk := haystack.(string)
	n, nOk := needle.(string)

	if !hOk || !nOk {
		return false, fmt.Errorf("ends_with operation requires string values")
	}

	return strings.HasSuffix(h, n), nil
}

func inArray(needle interface{}, haystack interface{}) (bool, error) {
	array, ok := haystack.([]interface{})
	if !ok {
		return false, fmt.Errorf("in operation requires array value")
	}

	for _, item := range array {
		if item == needle {
			return true, nil
		}
	}

	return false, nil
}

func toFloat64(v interface{}) (float64, bool) {
	switch value := v.(type) {
	case float64:
		return value, true
	case float32:
		return float64(value), true
	case int:
		return float64(value), true
	case int64:
		return float64(value), true
	case int32:
		return float64(value), true
	default:
		return 0, false
	}
}
