#!/bin/bash

# Example script for testing MySQL setup

echo "🚀 Testing MySQL Support for Workflow Engine"
echo "================================================"

# Set MySQL environment
export DATABASE_URL="mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true"
export REDIS_URL="redis://localhost:6379"
export PORT="8080"
export DEBUG="true"

echo "📋 Configuration:"
echo "Database: MySQL"
echo "URL: $DATABASE_URL"
echo "Redis: $REDIS_URL"
echo "Port: $PORT"
echo ""

echo "🏗️ Building application..."
make build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

echo "🧪 Running tests..."
make test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed!"
    exit 1
fi

echo "✅ Tests passed!"
echo ""

echo "🐳 Starting MySQL development environment..."
make dev-up-mysql

echo ""
echo "⏳ Waiting for MySQL to be ready..."
sleep 15

echo "🔄 Running database migrations..."
make migrate-up-mysql 2>/dev/null || echo "ℹ️ Migrations not available (install golang-migrate)"

echo ""
echo "🚀 Starting server with MySQL..."
echo "Use Ctrl+C to stop the server"
echo ""
echo "📊 Access points:"
echo "- API: http://localhost:8080"
echo "- Health: http://localhost:8080/health"
echo "- Metrics: http://localhost:8080/metrics"
echo "- Adminer: http://localhost:8081 (Server: mysql, User: user, Password: password)"
echo ""

# Start server (will run until Ctrl+C)
make run-mysql
