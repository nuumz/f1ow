# Workflow Engine API Examples with MySQL

This document provides examples of using the Workflow Engine API with MySQL backend.

## Prerequisites

1. Start MySQL development environment:
```bash
make dev-up-mysql
```

2. Run database migrations:
```bash
make migrate-up-mysql
```

3. Start the API server:
```bash
make run-mysql
```

## Basic API Usage

### 1. Health Check
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "mysql",
  "timestamp": "2024-01-XX"
}
```

### 2. Create a Simple Workflow

```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Data Processing",
    "description": "A basic workflow for data processing",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "config": {}
      },
      {
        "id": "http-fetch",
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
      {
        "from": "start",
        "to": "http-fetch"
      },
      {
        "from": "http-fetch",
        "to": "end"
      }
    ]
  }'
```

### 3. List Workflows

```bash
curl http://localhost:8080/api/workflows
```

### 4. Execute a Workflow

```bash
# Replace {workflow_id} with actual ID from creation response
curl -X POST http://localhost:8080/api/workflows/{workflow_id}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "userId": "user123",
      "requestId": "req456"
    }
  }'
```

### 5. Get Execution Status

```bash
# Replace {execution_id} with actual ID from execute response
curl http://localhost:8080/api/executions/{execution_id}
```

## Advanced Examples

### Complex Workflow with Multiple HTTP Nodes

```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Multi-API Integration",
    "description": "Workflow that calls multiple APIs and processes results",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "config": {}
      },
      {
        "id": "fetch-user",
        "type": "http",
        "config": {
          "url": "https://jsonplaceholder.typicode.com/users/1",
          "method": "GET",
          "headers": {
            "Accept": "application/json"
          }
        }
      },
      {
        "id": "fetch-posts",
        "type": "http",
        "config": {
          "url": "https://jsonplaceholder.typicode.com/posts?userId=1",
          "method": "GET",
          "headers": {
            "Accept": "application/json"
          }
        }
      },
      {
        "id": "end",
        "type": "end",
        "config": {}
      }
    ],
    "edges": [
      {
        "from": "start",
        "to": "fetch-user"
      },
      {
        "from": "start",
        "to": "fetch-posts"
      },
      {
        "from": "fetch-user",
        "to": "end"
      },
      {
        "from": "fetch-posts",
        "to": "end"
      }
    ]
  }'
```

### Workflow with Error Handling

```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Resilient API Call",
    "description": "Workflow with retry logic and error handling",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "config": {}
      },
      {
        "id": "api-call",
        "type": "http",
        "config": {
          "url": "https://httpstat.us/503",
          "method": "GET",
          "timeout": 5000,
          "retries": 3,
          "retryDelay": 1000
        }
      },
      {
        "id": "success",
        "type": "end",
        "config": {}
      },
      {
        "id": "error",
        "type": "end",
        "config": {}
      }
    ],
    "edges": [
      {
        "from": "start",
        "to": "api-call"
      },
      {
        "from": "api-call",
        "to": "success",
        "condition": "success"
      },
      {
        "from": "api-call",
        "to": "error",
        "condition": "error"
      }
    ]
  }'
```

## Monitoring and Debugging

### Check MySQL Data

Connect to MySQL container:
```bash
docker exec -it workflow-mysql mysql -u user -ppassword workflow_engine
```

Query workflows:
```sql
SELECT id, name, status, created_at FROM workflows ORDER BY created_at DESC LIMIT 5;
```

Query executions:
```sql
SELECT e.id, e.workflow_id, e.status, w.name 
FROM executions e 
JOIN workflows w ON e.workflow_id = w.id 
ORDER BY e.created_at DESC LIMIT 10;
```

### Application Logs

View server logs:
```bash
# If running in background
docker logs workflow-api

# If running with make run-mysql, logs appear in terminal
```

### Performance Metrics

```bash
curl http://localhost:8080/metrics
```

## Database Comparison

### Switch to PostgreSQL

```bash
# Stop MySQL environment
make dev-down

# Start PostgreSQL environment  
make dev-up

# Run migrations
make migrate-up

# Start server with PostgreSQL
make run
```

### Connection String Examples

PostgreSQL:
```bash
export DATABASE_URL="postgres://user:password@localhost:5432/workflow_engine?sslmode=disable"
```

MySQL:
```bash
export DATABASE_URL="mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true"
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Make sure MySQL container is running
   ```bash
   docker ps | grep mysql
   ```

2. **Migration errors**: Check if database exists
   ```bash
   docker exec -it workflow-mysql mysql -u user -ppassword -e "SHOW DATABASES;"
   ```

3. **JSON parsing errors**: Ensure MySQL 8.0+ is used
   ```bash
   docker exec -it workflow-mysql mysql -u user -ppassword -e "SELECT VERSION();"
   ```

### Reset Environment

```bash
# Stop and remove containers
make dev-down

# Remove volumes (caution: deletes all data)
docker volume rm workflow-engine_mysql_data

# Start fresh
make dev-up-mysql
make migrate-up-mysql
```
