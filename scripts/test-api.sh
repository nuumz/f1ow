#!/bin/bash

# Test script for workflow engine API
# This script can be used to test the API endpoints

API_BASE="http://localhost:8080"

echo "🚀 Testing Workflow Engine API..."
echo

# Test health endpoint
echo "📋 Testing health endpoint..."
curl -s "$API_BASE/health" | jq . || echo "Health endpoint not available or no jq installed"
echo

# Test metrics endpoint
echo "📊 Testing metrics endpoint..."
curl -s "$API_BASE/metrics" | head -20
echo "..."
echo

# Test workflow endpoints (these will require database)
echo "📝 Testing workflow endpoints (will fail without database)..."

# Test list workflows
echo "GET /api/workflows"
curl -s -X GET "$API_BASE/api/workflows" | jq . || echo "Failed - expected without database"
echo

# Test get node schemas
echo "GET /api/schemas/nodes"
curl -s -X GET "$API_BASE/api/schemas/nodes" | jq . || echo "Failed - this should work without database"
echo

# Test create workflow (sample)
echo "POST /api/workflows (sample workflow)"
curl -s -X POST "$API_BASE/api/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "description": "A simple test workflow",
    "definition": {
      "nodes": [
        {
          "id": "node1",
          "type": "http",
          "name": "HTTP Request",
          "position": {"x": 100, "y": 100},
          "data": {
            "url": "https://api.github.com/users/octocat",
            "method": "GET"
          }
        }
      ],
      "edges": []
    }
  }' | jq . || echo "Failed - expected without database"
echo

echo "✅ API test completed!"
echo
echo "To run the full test with database:"
echo "1. Start development services: make dev-up"
echo "2. Run the server: make run"
echo "3. Run this script again: ./scripts/test-api.sh"
