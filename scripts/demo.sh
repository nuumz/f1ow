#!/bin/bash

# Complete demo script for Workflow Engine with MySQL

echo "🚀 Workflow Engine MySQL Demo"
echo "============================="
echo ""
echo "This demo will:"
echo "1. Set up MySQL development environment"
echo "2. Build and start the workflow engine"
echo "3. Create sample workflows"
echo "4. Execute workflows and show results"
echo ""

read -p "Press Enter to continue or Ctrl+C to exit..."

cd /Users/phumin.k/appl/POC/workflow-engine

echo ""
echo "🐳 Step 1: Setting up MySQL environment..."
echo "----------------------------------------"
make dev-down 2>/dev/null || true
make dev-up-mysql

echo ""
echo "⏳ Waiting for MySQL to be ready..."
sleep 10

echo ""
echo "🔄 Step 2: Running database migrations..."
echo "---------------------------------------"
make migrate-up-mysql 2>/dev/null || echo "ℹ️ Migrations not available (install golang-migrate if needed)"

echo ""
echo "🏗️ Step 3: Building the application..."
echo "------------------------------------"
make build

echo ""
echo "🚀 Step 4: Starting the API server..."
echo "-----------------------------------"
echo "Server will start in background mode..."

# Start server in background
make run-mysql > server.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Log file: server.log"

# Wait for server to start
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi
    sleep 1
    echo "   Attempt $i/30..."
done

if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "❌ Server failed to start. Check server.log for details."
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🧪 Step 5: Running automated tests..."
echo "-----------------------------------"
./scripts/test-workflows.sh

echo ""
echo "📊 Step 6: Database inspection..."
echo "-------------------------------"
echo "Database content:"
docker exec workflow-mysql mysql -u user -ppassword workflow_engine -e "
SELECT 'Workflows' as table_name, COUNT(*) as count FROM workflows
UNION ALL
SELECT 'Executions' as table_name, COUNT(*) as count FROM executions
UNION ALL  
SELECT 'Nodes' as table_name, COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='workflow_engine';
" 2>/dev/null || echo "Could not access database"

echo ""
echo "🎉 Demo completed successfully!"
echo "=============================="
echo ""
echo "🔗 Access Points:"
echo "- API Health: http://localhost:8080/health"  
echo "- API Base: http://localhost:8080/api"
echo "- Adminer (MySQL GUI): http://localhost:8081"
echo "  - Server: mysql"
echo "  - Username: user"
echo "  - Password: password"
echo "  - Database: workflow_engine"
echo ""
echo "📝 Example API Calls:"
echo "curl http://localhost:8080/health"
echo "curl http://localhost:8080/api/workflows"
echo ""
echo "🛑 To stop the demo:"
echo "kill $SERVER_PID  # Stop API server"
echo "make dev-down     # Stop Docker containers"
echo ""
echo "📋 Server is running with PID: $SERVER_PID"
echo "📄 Server logs: tail -f server.log"

# Keep script running to show server status
echo ""
echo "🔄 Monitoring server status (Ctrl+C to exit)..."
while true; do
    if kill -0 $SERVER_PID 2>/dev/null; then
        STATUS=$(curl -s http://localhost:8080/health 2>/dev/null | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        echo "$(date '+%H:%M:%S') - Server Status: $STATUS"
    else
        echo "$(date '+%H:%M:%S') - Server stopped"
        break
    fi
    sleep 30
done
