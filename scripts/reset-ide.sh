#!/bin/bash

# Script to clear VS Code cache and restart Go language server

echo "🧹 Cleaning Go cache and modules..."
go clean -cache
go clean -modcache
go mod download

echo "🔄 Tidying modules..."
go mod tidy

echo "✅ Verifying build..."
go build -v ./...

echo "🧪 Running tests..."
go test -v ./tests/...

echo "📊 Build and test status:"
if [ $? -eq 0 ]; then
    echo "✅ All systems working correctly!"
    echo ""
    echo "💡 If VS Code still shows errors:"
    echo "1. Restart VS Code"
    echo "2. Use Cmd+Shift+P > 'Go: Restart Language Server'"
    echo "3. Use Cmd+Shift+P > 'Developer: Reload Window'"
else
    echo "❌ Tests failed!"
fi
