# MySQL Setup Guide

## Quick Start with MySQL

### 1. Start MySQL Development Environment

```bash
# Start MySQL + Redis + Adminer
make dev-up-mysql

# Or start all services (PostgreSQL + MySQL + Redis + Adminer)
make dev-up
```

### 2. Run Application with MySQL

```bash
# Method 1: Using Makefile command
make run-mysql

# Method 2: Using environment file
cp .env.mysql .env
make run-with-env

# Method 3: Manual export
export DATABASE_URL="mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true"
export REDIS_URL="redis://localhost:6379"
export PORT="8080"
export DEBUG="true"
./bin/server
```

### 3. Database Migration (Optional)

```bash
# Run MySQL migrations
make migrate-up-mysql

# Or manually
migrate -path ./migrations/mysql -database "mysql://user:password@tcp(localhost:3306)/workflow_engine" up
```

## Database Connection Formats

### MySQL Connection URLs

```bash
# Standard format
mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true

# With additional parameters
mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci

# Local socket (Unix)
mysql://user:password@unix(/tmp/mysql.sock)/workflow_engine?parseTime=true
```

### PostgreSQL (for comparison)

```bash
postgres://user:password@localhost:5432/workflow_engine?sslmode=disable
postgresql://user:password@localhost:5432/workflow_engine?sslmode=disable
```

## Environment Files

### .env.mysql (MySQL configuration)
```env
DATABASE_URL=mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true
REDIS_URL=redis://localhost:6379
PORT=8080
DEBUG=true
```

### .env.development (PostgreSQL configuration)
```env
DATABASE_URL=postgres://user:password@localhost:5432/workflow_engine?sslmode=disable
REDIS_URL=redis://localhost:6379
PORT=8080
DEBUG=true
```

## Available Commands

### Development
```bash
make dev-up            # Start all services (PostgreSQL + MySQL + Redis)
make dev-up-postgres   # Start only PostgreSQL + Redis + Adminer
make dev-up-mysql      # Start only MySQL + Redis + Adminer
make dev-down          # Stop all services
```

### Running Application
```bash
make run               # Run with PostgreSQL (default)
make run-mysql         # Run with MySQL
make run-with-env      # Run with .env file configuration
```

### Database Migration
```bash
make migrate-up        # PostgreSQL migrations
make migrate-up-mysql  # MySQL migrations
```

## Database Access

### Adminer (Web Interface)
- URL: http://localhost:8081
- **MySQL**: Server: `mysql`, User: `user`, Password: `password`, Database: `workflow_engine`
- **PostgreSQL**: Server: `postgres`, User: `user`, Password: `password`, Database: `workflow_engine`

### Direct Database Access

#### MySQL
```bash
# Using Docker
docker exec -it workflow-mysql mysql -u user -p workflow_engine

# Using local MySQL client
mysql -h localhost -P 3306 -u user -p workflow_engine
```

#### PostgreSQL
```bash
# Using Docker
docker exec -it workflow-postgres psql -U user -d workflow_engine

# Using local psql client
psql -h localhost -p 5432 -U user -d workflow_engine
```

## Schema Differences

### UUID Handling
- **PostgreSQL**: Uses `uuid_generate_v4()` extension
- **MySQL**: Uses `UUID()` function or Go-generated UUIDs

### JSON Support
- **PostgreSQL**: Native JSONB support
- **MySQL**: JSON data type (MySQL 5.7+)

### Auto-increment vs UUID
- Both databases use UUID as primary keys for consistency
- Application handles UUID generation

## Troubleshooting

### Connection Issues
1. Ensure Docker services are running: `docker ps`
2. Check service health: `docker-compose -f docker-compose.dev.yml ps`
3. View logs: `make dev-logs`

### Migration Issues
1. Ensure database is running and accessible
2. Check migration files exist in correct directory
3. Verify connection string format

### Performance Considerations
- MySQL uses InnoDB engine for ACID compliance
- Both databases have connection pooling configured
- Indexes are created for common query patterns
