package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"workflow-engine/internal/engine"

	"github.com/dop251/goja"
)

// TransformNode implements JavaScript code execution
type TransformNode struct {
	BaseNode
}

// TransformConfig defines configuration for transform node
type TransformConfig struct {
	Code           string            `json:"code"`
	InputVariables map[string]string `json:"input_variables"`
	OutputVariable string            `json:"output_variable"`
	Packages       []string          `json:"packages"`
	Timeout        int               `json:"timeout"` // seconds
}

// NewTransformNode creates a new transform node
func NewTransformNode() engine.NodeType {
	return &TransformNode{
		BaseNode: BaseNode{
			nodeType:    "transform",
			name:        "Transform",
			description: "Transform data using JavaScript code",
			category:    "Data Processing",
			icon:        "code",
		},
	}
}

// Execute runs the JavaScript code
func (n *TransformNode) Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error) {
	transformConfig, err := n.parseConfig(config)
	if err != nil {
		return nil, err
	}

	// Create JavaScript VM
	vm := goja.New()

	// Add console.log support
	console := vm.NewObject()
	logs := []string{}
	console.Set("log", func(args ...interface{}) {
		for _, arg := range args {
			logs = append(logs, fmt.Sprintf("%v", arg))
		}
	})
	vm.Set("console", console)

	// Add input data
	inputData := make(map[string]interface{})
	if inputMap, ok := input.(map[string]interface{}); ok {
		inputData = inputMap
	} else {
		inputData["data"] = input
	}

	// Set input variables
	for varName, path := range transformConfig.InputVariables {
		value := getValueByPath(inputData, path)
		vm.Set(varName, value)
	}

	// Add utility functions
	vm.Set("JSON", map[string]interface{}{
		"parse": func(str string) (interface{}, error) {
			var result interface{}
			err := json.Unmarshal([]byte(str), &result)
			return result, err
		},
		"stringify": func(obj interface{}) (string, error) {
			bytes, err := json.Marshal(obj)
			return string(bytes), err
		},
	})

	// Execute code
	result, err := vm.RunString(transformConfig.Code)
	if err != nil {
		return nil, fmt.Errorf("JavaScript execution error: %w", err)
	}

	// Get output
	var output interface{}
	if transformConfig.OutputVariable != "" {
		outputValue := vm.Get(transformConfig.OutputVariable)
		if !goja.IsUndefined(outputValue) && !goja.IsNull(outputValue) {
			output = outputValue.Export()
		}
	} else {
		output = result.Export()
	}

	// Include logs in output if any
	resultMap := make(map[string]interface{})
	if outputMap, ok := output.(map[string]interface{}); ok {
		resultMap = outputMap
	} else {
		resultMap["result"] = output
	}

	if len(logs) > 0 {
		resultMap["_logs"] = logs
	}

	return resultMap, nil
}

// ValidateConfig validates the node configuration
func (n *TransformNode) ValidateConfig(config interface{}) error {
	transformConfig, err := n.parseConfig(config)
	if err != nil {
		return err
	}

	if transformConfig.Code == "" {
		return fmt.Errorf("code is required")
	}

	// Try to parse the code to check for syntax errors
	vm := goja.New()
	_, err = vm.RunString(transformConfig.Code)
	if err != nil {
		return fmt.Errorf("invalid JavaScript code: %w", err)
	}

	return nil
}

// GetSchema returns the node configuration schema
func (n *TransformNode) GetSchema() engine.NodeSchema {
	return engine.NodeSchema{
		Type: "object",
		Properties: map[string]engine.Property{
			"code": {
				Type:        "string",
				Title:       "JavaScript Code",
				Description: "JavaScript code to execute. Input variables are available in the global scope.",
				Format:      "javascript",
			},
			"input_variables": {
				Type:        "object",
				Title:       "Input Variables",
				Description: "Map of variable names to data paths (e.g., 'myVar': 'data.field')",
			},
			"output_variable": {
				Type:        "string",
				Title:       "Output Variable",
				Description: "Name of the variable containing the output (optional, defaults to last expression)",
			},
			"timeout": {
				Type:        "number",
				Title:       "Timeout",
				Description: "Execution timeout in seconds",
				Default:     30,
			},
		},
		Required: []string{"code"},
		Inputs: []engine.PortSchema{
			{
				Name:        "input",
				Type:        "any",
				Description: "Input data to transform",
				Required:    false,
			},
		},
		Outputs: []engine.PortSchema{
			{
				Name:        "output",
				Type:        "any",
				Description: "Transformed data",
				Required:    true,
			},
		},
	}
}

// parseConfig parses the node configuration
func (n *TransformNode) parseConfig(config interface{}) (*TransformConfig, error) {
	configMap, ok := config.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid config type for transform node")
	}

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var transformConfig TransformConfig
	if err := json.Unmarshal(configJSON, &transformConfig); err != nil {
		return nil, fmt.Errorf("failed to parse transform config: %w", err)
	}

	return &transformConfig, nil
}

// getValueByPath retrieves a value from a map using dot notation path
func getValueByPath(data map[string]interface{}, path string) interface{} {
	if path == "" || path == "." {
		return data
	}

	parts := splitPath(path)
	current := interface{}(data)

	for _, part := range parts {
		switch v := current.(type) {
		case map[string]interface{}:
			current = v[part]
		case []interface{}:
			// Handle array index
			if index, err := parseArrayIndex(part); err == nil && index < len(v) {
				current = v[index]
			} else {
				return nil
			}
		default:
			return nil
		}
	}

	return current
}

// splitPath splits a dot notation path
func splitPath(path string) []string {
	// Simple implementation - could be enhanced to handle escaped dots
	return strings.Split(path, ".")
}

// parseArrayIndex parses array index from string
func parseArrayIndex(s string) (int, error) {
	if len(s) > 2 && s[0] == '[' && s[len(s)-1] == ']' {
		var index int
		_, err := fmt.Sscanf(s[1:len(s)-1], "%d", &index)
		return index, err
	}
	return 0, fmt.Errorf("not an array index")
}
