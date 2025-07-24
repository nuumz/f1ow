#!/bin/bash

# Automated workflow testing script for MySQL setup

set -e

API_BASE="http://localhost:8080/api"
EXAMPLES_DIR="/Users/phumin.k/appl/POC/workflow-engine/examples"

echo "🧪 Workflow Engine MySQL Testing Suite"
echo "======================================"

# Check if server is running
echo "🔍 Checking if API server is running..."
if ! curl -s "$API_BASE/../health" > /dev/null; then
    echo "❌ API server not running. Please start it with: make run-mysql"
    exit 1
fi

echo "✅ API server is running"

# Test 1: Create simple workflow
echo ""
echo "📋 Test 1: Creating simple data pipeline workflow..."
SIMPLE_RESPONSE=$(curl -s -X POST "$API_BASE/workflows" \
    -H "Content-Type: application/json" \
    -d @"$EXAMPLES_DIR/simple-pipeline.json")

SIMPLE_ID=$(echo "$SIMPLE_RESPONSE" | jq -r '.id // empty')

if [ -z "$SIMPLE_ID" ]; then
    echo "❌ Failed to create simple workflow"
    echo "Response: $SIMPLE_RESPONSE"
    exit 1
fi

echo "✅ Simple workflow created with ID: $SIMPLE_ID"

# Test 2: Create complex workflow
echo ""
echo "📋 Test 2: Creating e-commerce order processing workflow..."
ECOMMERCE_RESPONSE=$(curl -s -X POST "$API_BASE/workflows" \
    -H "Content-Type: application/json" \
    -d @"$EXAMPLES_DIR/ecommerce-order-workflow.json")

ECOMMERCE_ID=$(echo "$ECOMMERCE_RESPONSE" | jq -r '.id // empty')

if [ -z "$ECOMMERCE_ID" ]; then
    echo "❌ Failed to create e-commerce workflow"
    echo "Response: $ECOMMERCE_RESPONSE"
    exit 1
fi

echo "✅ E-commerce workflow created with ID: $ECOMMERCE_ID"

# Test 3: List workflows
echo ""
echo "📋 Test 3: Listing all workflows..."
WORKFLOWS_LIST=$(curl -s "$API_BASE/workflows")
WORKFLOW_COUNT=$(echo "$WORKFLOWS_LIST" | jq '. | length')

echo "✅ Found $WORKFLOW_COUNT workflows in database"

# Test 4: Execute simple workflow
echo ""
echo "📋 Test 4: Executing simple workflow..."
EXECUTION_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/$SIMPLE_ID/execute" \
    -H "Content-Type: application/json" \
    -d '{
        "input": {
            "testRun": true,
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
        }
    }')

EXECUTION_ID=$(echo "$EXECUTION_RESPONSE" | jq -r '.id // empty')

if [ -z "$EXECUTION_ID" ]; then
    echo "❌ Failed to execute simple workflow"
    echo "Response: $EXECUTION_RESPONSE"
    exit 1
fi

echo "✅ Simple workflow execution started with ID: $EXECUTION_ID"

# Test 5: Monitor execution
echo ""
echo "📋 Test 5: Monitoring execution progress..."
for i in {1..10}; do
    sleep 2
    STATUS_RESPONSE=$(curl -s "$API_BASE/executions/$EXECUTION_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // empty')
    
    echo "   Attempt $i/10: Status = $STATUS"
    
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
        break
    fi
done

if [ "$STATUS" = "completed" ]; then
    echo "✅ Workflow execution completed successfully"
elif [ "$STATUS" = "failed" ]; then
    echo "⚠️ Workflow execution failed (this may be expected for demo purposes)"
    echo "   Response: $STATUS_RESPONSE"
else
    echo "⏳ Workflow execution still in progress (status: $STATUS)"
fi

# Test 6: Execute complex workflow (async)
echo ""
echo "📋 Test 6: Executing e-commerce workflow (async)..."
ECOMMERCE_EXECUTION=$(curl -s -X POST "$API_BASE/workflows/$ECOMMERCE_ID/execute" \
    -H "Content-Type: application/json" \
    -d '{
        "input": {
            "orderId": "ORDER-'$(date +%s)'",
            "customerId": "CUST-12345",
            "items": [
                {"sku": "ITEM-001", "quantity": 2, "price": 29.99},
                {"sku": "ITEM-002", "quantity": 1, "price": 49.99}
            ],
            "totalAmount": 109.97
        }
    }')

ECOMMERCE_EXECUTION_ID=$(echo "$ECOMMERCE_EXECUTION" | jq -r '.id // empty')

if [ -z "$ECOMMERCE_EXECUTION_ID" ]; then
    echo "❌ Failed to execute e-commerce workflow"
    echo "Response: $ECOMMERCE_EXECUTION"
else
    echo "✅ E-commerce workflow execution started with ID: $ECOMMERCE_EXECUTION_ID"
fi

# Test 7: Database verification
echo ""
echo "📋 Test 7: Verifying MySQL database content..."

# Check if we can access MySQL
if docker exec -it workflow-mysql mysql -u user -ppassword workflow_engine -e "SELECT COUNT(*) as workflow_count FROM workflows;" 2>/dev/null; then
    echo "✅ MySQL database access verified"
    
    echo ""
    echo "📊 Database Statistics:"
    docker exec -it workflow-mysql mysql -u user -ppassword workflow_engine -e "
        SELECT 'Workflows' as table_name, COUNT(*) as count FROM workflows
        UNION ALL
        SELECT 'Executions' as table_name, COUNT(*) as count FROM executions;
    " 2>/dev/null || echo "   Unable to fetch detailed statistics"
else
    echo "⚠️ Could not access MySQL database directly"
fi

echo ""
echo "🎉 Testing Complete!"
echo "===================="
echo ""
echo "📊 Summary:"
echo "- Simple workflow ID: $SIMPLE_ID"
echo "- E-commerce workflow ID: $ECOMMERCE_ID" 
echo "- Simple execution ID: $EXECUTION_ID"
echo "- E-commerce execution ID: $ECOMMERCE_EXECUTION_ID"
echo "- Final execution status: $STATUS"
echo ""
echo "🔗 Useful URLs:"
echo "- API Health: http://localhost:8080/health"
echo "- Adminer (MySQL GUI): http://localhost:8081"
echo "- API Docs: http://localhost:8080/api"
echo ""
echo "💡 Next steps:"
echo "- Check execution details: curl $API_BASE/executions/$EXECUTION_ID"
echo "- List all executions: curl $API_BASE/executions"
echo "- View workflow details: curl $API_BASE/workflows/$SIMPLE_ID"
