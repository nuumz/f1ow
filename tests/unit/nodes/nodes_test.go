package nodes_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nuumz/f1ow/internal/nodes"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPNode_Execute(t *testing.T) {
	// Create a test HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "success", "status": "ok"}`))
	}))
	defer server.Close()

	node := &nodes.HTTPNode{}

	config := map[string]interface{}{
		"url":    server.URL,
		"method": "GET",
		"headers": map[string]interface{}{
			"Accept": "application/json",
		},
	}

	input := map[string]interface{}{
		"test": "data",
	}

	ctx := context.Background()
	result, err := node.Execute(ctx, config, input)

	require.NoError(t, err)
	assert.NotNil(t, result)

	// Check the result structure
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	assert.Contains(t, resultMap, "statusCode")
	assert.Contains(t, resultMap, "body")
	assert.Contains(t, resultMap, "headers")

	assert.Equal(t, 200, resultMap["statusCode"])
}

func TestHTTPNode_ValidateConfig(t *testing.T) {
	node := &nodes.HTTPNode{}

	tests := []struct {
		name    string
		config  interface{}
		wantErr bool
	}{
		{
			name: "valid config",
			config: map[string]interface{}{
				"url":    "https://api.example.com",
				"method": "GET",
			},
			wantErr: false,
		},
		{
			name: "missing url",
			config: map[string]interface{}{
				"method": "GET",
			},
			wantErr: true,
		},
		{
			name: "invalid method",
			config: map[string]interface{}{
				"url":    "https://api.example.com",
				"method": "INVALID",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := node.ValidateConfig(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestHTTPNode_GetSchema(t *testing.T) {
	node := &nodes.HTTPNode{}
	schema := node.GetSchema()

	assert.NotNil(t, schema)
	assert.Equal(t, "object", schema.Type)
	assert.NotEmpty(t, schema.Properties)
	assert.Contains(t, schema.Properties, "url")
	assert.Contains(t, schema.Properties, "method")
	assert.Contains(t, schema.Required, "url")
}

func TestTransformNode_Execute(t *testing.T) {
	node := &nodes.TransformNode{}

	config := map[string]interface{}{
		"code": `
			var result = input.value * 2;
			output = { "result": result };
		`,
		"input_variables": map[string]interface{}{
			"input": "data",
		},
		"output_variable": "output",
	}

	input := map[string]interface{}{
		"data": map[string]interface{}{
			"value": 21,
		},
	}

	ctx := context.Background()
	result, err := node.Execute(ctx, config, input)

	require.NoError(t, err)
	assert.NotNil(t, result)

	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok)

	// The output should contain the result
	assert.Contains(t, resultMap, "result")
	assert.Equal(t, int64(42), resultMap["result"])
}
