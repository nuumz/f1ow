# Testing Guide

## Test Structure

```
tests/
├── unit/
│   ├── engine/
│   │   └── registry_test.go    # Engine registry tests
│   ├── nodes/
│   │   └── nodes_test.go       # Node implementation tests
│   └── storage/
│       └── storage_test.go     # Storage layer tests
├── integration/    # (Future) Integration tests
└── e2e/           # (Future) End-to-end tests
```

## Running Tests

### All Tests
```bash
make test
```

### Test Coverage
```bash
make test-coverage
```

### Individual Test Packages
```bash
# Engine tests
go test -v ./tests/unit/engine/

# Node tests  
go test -v ./tests/unit/nodes/

# Storage tests
go test -v ./tests/unit/storage/
```

## Test Results

Latest test run results:
- ✅ TestNodeRegistry_Register - PASS
- ✅ TestNodeRegistry_Get - PASS  
- ✅ TestNodeRegistry_Categories - PASS
- ✅ TestHTTPNode_Execute - PASS
- ✅ TestHTTPNode_ValidateConfig - PASS
- ✅ TestHTTPNode_GetSchema - PASS
- ✅ TestTransformNode_Execute - PASS
- ✅ TestDatabaseConnection - PASS
- ✅ TestRedisConnection - PASS

**All tests passing! ✅**

## Adding New Tests

### For Engine Components
Add test files to `tests/unit/engine/`

### For Node Types
Add test files to `tests/unit/nodes/`

### For Storage Layer
Add test files to `tests/unit/storage/`

## Test Guidelines

1. Use descriptive test names
2. Test both success and error cases
3. Use table-driven tests for multiple scenarios
4. Mock external dependencies
5. Keep tests fast and independent

## Integration Tests (Future)

Will include:
- Database integration tests
- Redis integration tests
- API endpoint tests
- Workflow execution tests
