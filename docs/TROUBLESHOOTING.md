# Troubleshooting Guide

## Common Issues and Solutions

### 1. VS Code Shows "Duplicate Declaration" Errors

**Problem**: VS Code IDE shows duplicate declaration errors even though code compiles and runs correctly.

**Symptoms**:
- Red underlines in VS Code
- Errors like "HTTPNode redeclared in this block"
- Code builds and tests pass successfully

**Solution**:
```bash
# Method 1: Run the reset script
./scripts/reset-ide.sh

# Method 2: Manual steps
go clean -cache
go mod tidy
# Then restart VS Code or reload window
```

**VS Code Commands**:
- `Cmd+Shift+P` > "Go: Restart Language Server"
- `Cmd+Shift+P` > "Developer: Reload Window"

### 2. Tests Not Found

**Problem**: Tests don't run from `internal/` directories.

**Solution**: Tests are now organized in `tests/` directory:
```
tests/
├── unit/
│   ├── engine/
│   ├── nodes/
│   └── storage/
```

Run with: `make test` or `go test -v ./tests/...`

### 3. Build Failures

**Problem**: Build fails with import errors.

**Solution**:
```bash
go mod tidy
go mod download
make build
```

### 4. Missing Dependencies

**Problem**: Package not found errors.

**Solution**:
```bash
go get <package-name>
go mod tidy
```

## Verification Commands

To verify everything is working:

```bash
# Check compilation
make build

# Run all tests
make test

# Check for any Go issues
go vet ./...

# Check formatting
go fmt ./...
```

## Expected Results

All commands should complete successfully:
- ✅ Build completes without errors
- ✅ All tests pass
- ✅ No vet warnings
- ✅ Code is properly formatted

## When to Use This Guide

Use this guide when:
- VS Code shows errors but Go commands work fine
- Tests were moved to new structure
- After major refactoring
- Setting up a new development environment
