package nodes

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"workflow-engine/internal/engine"
)

// HTTPNode implements HTTP request functionality
type HTTPNode struct {
	BaseNode
	client *http.Client
}

// HTTPConfig defines configuration for HTTP node
type HTTPConfig struct {
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         map[string]string `json:"headers"`
	QueryParams     map[string]string `json:"query_params"`
	Body            interface{}       `json:"body"`
	Authentication  *HTTPAuth         `json:"authentication"`
	Timeout         int               `json:"timeout"` // seconds
	RetryCount      int               `json:"retry_count"`
	RetryDelay      int               `json:"retry_delay"` // seconds
	IgnoreSSLIssues bool              `json:"ignore_ssl_issues"`
	ResponseType    string            `json:"response_type"` // "json", "text", "binary"
}

// HTTPAuth defines authentication options
type HTTPAuth struct {
	Type           string `json:"type"` // "none", "basic", "bearer", "api_key"
	Username       string `json:"username"`
	Password       string `json:"password"`
	Token          string `json:"token"`
	APIKey         string `json:"api_key"`
	APIKeyName     string `json:"api_key_name"`
	APIKeyLocation string `json:"api_key_location"` // "header", "query"
}

// NewHTTPNode creates a new HTTP node
func NewHTTPNode() engine.NodeType {
	return &HTTPNode{
		BaseNode: BaseNode{
			nodeType:    "http",
			name:        "HTTP Request",
			description: "Make HTTP requests to any API or web service",
			category:    "Network",
			icon:        "globe",
		},
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Execute performs the HTTP request
func (n *HTTPNode) Execute(ctx context.Context, config interface{}, input interface{}) (interface{}, error) {
	httpConfig, err := n.parseConfig(config)
	if err != nil {
		return nil, err
	}

	// Process template variables
	url := processTemplate(httpConfig.URL, input)

	// Build request
	req, err := n.buildRequest(ctx, httpConfig, url, input)
	if err != nil {
		return nil, err
	}

	// Configure client
	client := n.configureClient(httpConfig)

	// Execute with retry
	var resp *http.Response
	var lastErr error

	retryCount := httpConfig.RetryCount
	if retryCount == 0 {
		retryCount = 1
	}

	for i := 0; i < retryCount; i++ {
		if i > 0 {
			time.Sleep(time.Duration(httpConfig.RetryDelay) * time.Second)
		}

		resp, lastErr = client.Do(req)
		if lastErr == nil && resp.StatusCode < 500 {
			break
		}

		if resp != nil {
			resp.Body.Close()
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", lastErr)
	}

	defer resp.Body.Close()

	// Read response
	return n.processResponse(resp, httpConfig.ResponseType)
}

// ValidateConfig validates the node configuration
func (n *HTTPNode) ValidateConfig(config interface{}) error {
	httpConfig, err := n.parseConfig(config)
	if err != nil {
		return err
	}

	if httpConfig.URL == "" {
		return fmt.Errorf("URL is required")
	}

	validMethods := map[string]bool{
		"GET": true, "POST": true, "PUT": true, "PATCH": true,
		"DELETE": true, "HEAD": true, "OPTIONS": true,
	}

	if httpConfig.Method != "" && !validMethods[strings.ToUpper(httpConfig.Method)] {
		return fmt.Errorf("invalid HTTP method: %s", httpConfig.Method)
	}

	return nil
}

// GetSchema returns the node configuration schema
func (n *HTTPNode) GetSchema() engine.NodeSchema {
	return engine.NodeSchema{
		Type: "object",
		Properties: map[string]engine.Property{
			"url": {
				Type:        "string",
				Title:       "URL",
				Description: "The URL to send the request to. Supports template variables like {{variable}}",
			},
			"method": {
				Type:        "string",
				Title:       "Method",
				Description: "HTTP method",
				Default:     "GET",
				Enum:        []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
			},
			"headers": {
				Type:        "object",
				Title:       "Headers",
				Description: "HTTP headers to send with the request",
			},
			"query_params": {
				Type:        "object",
				Title:       "Query Parameters",
				Description: "Query parameters to append to the URL",
			},
			"body": {
				Type:        "object",
				Title:       "Body",
				Description: "Request body (for POST, PUT, PATCH)",
			},
			"authentication": {
				Type:        "object",
				Title:       "Authentication",
				Description: "Authentication settings",
			},
			"timeout": {
				Type:        "number",
				Title:       "Timeout",
				Description: "Request timeout in seconds",
				Default:     30,
			},
			"retry_count": {
				Type:        "number",
				Title:       "Retry Count",
				Description: "Number of retries on failure",
				Default:     0,
			},
			"response_type": {
				Type:        "string",
				Title:       "Response Type",
				Description: "How to parse the response",
				Default:     "json",
				Enum:        []string{"json", "text", "binary"},
			},
		},
		Required: []string{"url"},
		Inputs: []engine.PortSchema{
			{
				Name:        "input",
				Type:        "any",
				Description: "Input data available for template variables",
				Required:    false,
			},
		},
		Outputs: []engine.PortSchema{
			{
				Name:        "output",
				Type:        "object",
				Description: "Response object with statusCode, headers, and body",
				Required:    true,
			},
		},
	}
}

// parseConfig parses the node configuration
func (n *HTTPNode) parseConfig(config interface{}) (*HTTPConfig, error) {
	configMap, ok := config.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid config type for HTTP node")
	}

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var httpConfig HTTPConfig
	if err := json.Unmarshal(configJSON, &httpConfig); err != nil {
		return nil, fmt.Errorf("failed to parse HTTP config: %w", err)
	}

	// Set defaults
	if httpConfig.Method == "" {
		httpConfig.Method = "GET"
	}

	return &httpConfig, nil
}

// buildRequest builds the HTTP request
func (n *HTTPNode) buildRequest(ctx context.Context, config *HTTPConfig, url string, input interface{}) (*http.Request, error) {
	// Add query parameters
	if len(config.QueryParams) > 0 {
		params := make([]string, 0, len(config.QueryParams))
		for k, v := range config.QueryParams {
			processedValue := processTemplate(v, input)
			params = append(params, fmt.Sprintf("%s=%s", k, processedValue))
		}
		separator := "?"
		if strings.Contains(url, "?") {
			separator = "&"
		}
		url = url + separator + strings.Join(params, "&")
	}

	// Prepare body
	var body io.Reader
	if config.Body != nil {
		processedBody := interpolateValue(config.Body, input)
		jsonBody, err := json.Marshal(processedBody)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal body: %w", err)
		}
		body = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, config.Method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	for key, value := range config.Headers {
		processedValue := processTemplate(value, input)
		req.Header.Set(key, processedValue)
	}

	// Set content type for body
	if config.Body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	// Apply authentication
	if err := n.applyAuthentication(req, config.Authentication, input); err != nil {
		return nil, fmt.Errorf("failed to apply authentication: %w", err)
	}

	return req, nil
}

// configureClient configures the HTTP client based on settings
func (n *HTTPNode) configureClient(config *HTTPConfig) *http.Client {
	client := &http.Client{
		Timeout: time.Duration(config.Timeout) * time.Second,
	}

	if config.Timeout == 0 {
		client.Timeout = 30 * time.Second
	}

	if config.IgnoreSSLIssues {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		}
	}

	return client
}

// applyAuthentication applies authentication to the request
func (n *HTTPNode) applyAuthentication(req *http.Request, auth *HTTPAuth, input interface{}) error {
	if auth == nil || auth.Type == "none" {
		return nil
	}

	switch auth.Type {
	case "basic":
		username := processTemplate(auth.Username, input)
		password := processTemplate(auth.Password, input)
		basicAuth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		req.Header.Set("Authorization", "Basic "+basicAuth)

	case "bearer":
		token := processTemplate(auth.Token, input)
		req.Header.Set("Authorization", "Bearer "+token)

	case "api_key":
		apiKey := processTemplate(auth.APIKey, input)
		if auth.APIKeyLocation == "query" {
			q := req.URL.Query()
			q.Add(auth.APIKeyName, apiKey)
			req.URL.RawQuery = q.Encode()
		} else {
			req.Header.Set(auth.APIKeyName, apiKey)
		}

	default:
		return fmt.Errorf("unsupported authentication type: %s", auth.Type)
	}

	return nil
}

// processResponse processes the HTTP response
func (n *HTTPNode) processResponse(resp *http.Response, responseType string) (interface{}, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	result := map[string]interface{}{
		"statusCode": resp.StatusCode,
		"status":     resp.Status,
		"headers":    resp.Header,
	}

	// Process body based on response type
	switch responseType {
	case "binary":
		result["body"] = base64.StdEncoding.EncodeToString(body)
		result["bodyType"] = "base64"

	case "text":
		result["body"] = string(body)
		result["bodyType"] = "text"

	default: // json
		var jsonBody interface{}
		if err := json.Unmarshal(body, &jsonBody); err != nil {
			// If not valid JSON, return as text
			result["body"] = string(body)
			result["bodyType"] = "text"
		} else {
			result["body"] = jsonBody
			result["bodyType"] = "json"
		}
	}

	return result, nil
}
