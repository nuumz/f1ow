package nodes

import (
	"fmt"
	"regexp"
	"strings"
)

// BaseNode provides common functionality for all nodes
type BaseNode struct {
	nodeType    string
	name        string
	description string
	category    string
	icon        string
}

// Type returns the node type identifier
func (b *BaseNode) Type() string {
	return b.nodeType
}

// Name returns the display name of the node
func (b *BaseNode) Name() string {
	return b.name
}

// Description returns the node description
func (b *BaseNode) Description() string {
	return b.description
}

// Category returns the node category
func (b *BaseNode) Category() string {
	return b.category
}

// Icon returns the node icon
func (b *BaseNode) Icon() string {
	return b.icon
}

// processTemplate replaces template variables in a string
func processTemplate(template string, data interface{}) string {
	// Handle {{variable}} syntax
	re := regexp.MustCompile(`\{\{([^}]+)\}\}`)

	return re.ReplaceAllStringFunc(template, func(match string) string {
		// Extract variable name
		varName := strings.TrimSpace(match[2 : len(match)-2])

		// Try to get value from data
		if dataMap, ok := data.(map[string]interface{}); ok {
			if value, exists := dataMap[varName]; exists {
				return fmt.Sprintf("%v", value)
			}
		}

		// Return original if not found
		return match
	})
}

// interpolateValue processes template variables in various value types
func interpolateValue(value interface{}, data interface{}) interface{} {
	switch v := value.(type) {
	case string:
		return processTemplate(v, data)
	case map[string]interface{}:
		result := make(map[string]interface{})
		for k, val := range v {
			result[k] = interpolateValue(val, data)
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(v))
		for i, val := range v {
			result[i] = interpolateValue(val, data)
		}
		return result
	default:
		return value
	}
}

// mergeData merges input data with additional data
func mergeData(input interface{}, additional map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// Add input data
	if inputMap, ok := input.(map[string]interface{}); ok {
		for k, v := range inputMap {
			result[k] = v
		}
	} else {
		result["data"] = input
	}

	// Add additional data
	for k, v := range additional {
		result[k] = v
	}

	return result
}
