# 🚀 Quick Start Guide - Workflow Engine with MySQL

This guide gets you up and running with the Workflow Engine using MySQL in under 5 minutes.

## Prerequisites

- Docker and Docker Compose
- Go 1.21+
- Make
- curl and jq (for testing)

## Option 1: One-Command Demo 🎯

```bash
./scripts/demo.sh
```

This script will:
- Set up MySQL + Redis environment
- Build and start the workflow engine
- Create and execute sample workflows
- Show you all access points and examples

## Option 2: Step-by-Step Setup 📋

### 1. Start MySQL Environment

```bash
make dev-up-mysql
```

This starts:
- MySQL 8.0 database on port 3306
- Redis cache on port 6379
- Adminer web UI on port 8081

### 2. Run Database Migrations

```bash
make migrate-up-mysql
```

### 3. Start the API Server

```bash
make run-mysql
```

The API will be available at http://localhost:8080

### 4. Test the Setup

```bash
# Check server health
curl http://localhost:8080/health

# Expected response:
# {"status":"ok","database":"mysql","timestamp":"2024-XX-XX"}
```

### 5. Create Your First Workflow

```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Workflow",
    "description": "Simple data fetching workflow",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "config": {}
      },
      {
        "id": "fetch-data",
        "type": "http",
        "config": {
          "url": "https://jsonplaceholder.typicode.com/posts/1",
          "method": "GET"
        }
      },
      {
        "id": "end",
        "type": "end", 
        "config": {}
      }
    ],
    "edges": [
      {"from": "start", "to": "fetch-data"},
      {"from": "fetch-data", "to": "end"}
    ]
  }'
```

### 6. Execute the Workflow

```bash
# Use the workflow ID from the previous response
curl -X POST http://localhost:8080/api/workflows/{WORKFLOW_ID}/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"test": true}}'
```

### 7. Check Execution Status

```bash
# Use the execution ID from the previous response
curl http://localhost:8080/api/executions/{EXECUTION_ID}
```

## Pre-built Examples 📁

Use ready-made workflow templates:

### Simple Data Pipeline
```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d @examples/simple-pipeline.json
```

### E-commerce Order Processing
```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d @examples/ecommerce-order-workflow.json
```

## Automated Testing 🧪

Run comprehensive tests:

```bash
# Test MySQL setup
./scripts/test-mysql.sh

# Test workflow creation and execution
./scripts/test-workflows.sh
```

## Web Interface Access 🌐

### Adminer (MySQL GUI)
- URL: http://localhost:8081
- Server: `mysql`
- Username: `user`
- Password: `password`
- Database: `workflow_engine`

### API Endpoints
- Health Check: http://localhost:8080/health
- List Workflows: http://localhost:8080/api/workflows
- API Documentation: Available through curl commands

## Database Inspection 🔍

### Connect to MySQL directly:
```bash
docker exec -it workflow-mysql mysql -u user -ppassword workflow_engine
```

### Useful SQL queries:
```sql
-- List all workflows
SELECT id, name, status, created_at FROM workflows;

-- List all executions
SELECT e.id, e.workflow_id, e.status, w.name 
FROM executions e 
JOIN workflows w ON e.workflow_id = w.id 
ORDER BY e.created_at DESC;

-- Check workflow structure
SELECT id, name, JSON_PRETTY(definition) 
FROM workflows 
WHERE name = 'My First Workflow';
```

## Switching Databases 🔄

### Switch to PostgreSQL:
```bash
make dev-down        # Stop MySQL
make dev-up          # Start PostgreSQL
make migrate-up      # Run PostgreSQL migrations
make run            # Start with PostgreSQL
```

### Switch back to MySQL:
```bash
make dev-down        # Stop PostgreSQL
make dev-up-mysql    # Start MySQL
make migrate-up-mysql # Run MySQL migrations
make run-mysql       # Start with MySQL
```

## Troubleshooting 🔧

### Server won't start
```bash
# Check if ports are available
lsof -i :8080
lsof -i :3306
lsof -i :6379

# Check Docker containers
docker ps
```

### Database connection issues
```bash
# Test MySQL connection
docker exec -it workflow-mysql mysql -u user -ppassword -e "SELECT 1;"

# Check container logs
docker logs workflow-mysql
```

### Reset everything
```bash
make dev-down
docker volume rm workflow-engine_mysql_data
make dev-up-mysql
make migrate-up-mysql
```

## Next Steps 🎯

1. **Explore the API**: Check out `docs/mysql-examples.md` for comprehensive API examples
2. **Create Custom Workflows**: Design workflows for your specific use cases
3. **Monitor Executions**: Set up logging and monitoring for production use
4. **Scale Up**: Deploy using Docker containers in production

## Support 💬

- Check `docs/` directory for detailed documentation
- Review `examples/` for workflow templates
- Run `./scripts/test-workflows.sh` for validation
- Examine server logs with `tail -f server.log` (when using demo script)
