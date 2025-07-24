# Workflow Engine

A high-performance, open-source workflow automation platform with AI capabilities, built with Go and React.

## ✨ Features

- 🚀 **High Performance**: Handle 10,000+ workflows/second
- 🤖 **AI-Native**: Built-in LangChain integration and multi-agent orchestration
- 🔄 **Sub-workflows**: Modular workflow composition
- 📊 **Visual Designer**: Drag-and-drop workflow creation
- 🔌 **50+ Node Types**: Extensive integration capabilities
- 🗄️ **Multi-Database**: PostgreSQL & MySQL support with auto-detection
- 🏗️ **Cloud-Native**: Kubernetes-ready with horizontal scaling
- 🔒 **Enterprise-Ready**: RBAC, audit logs, and monitoring
- 📝 **100% Open Source**: MIT licensed

## 🚀 Quick Start

> **New!** Try the one-command demo: `./scripts/demo.sh`

### Prerequisites

- Go 1.21+
- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- **Database**: PostgreSQL 15+ OR MySQL 8.0+ (with JSON support)

### Option 1: MySQL Setup (Recommended for new users)

```bash
# Clone and setup
git clone https://github.com/yourusername/workflow-engine.git
cd workflow-engine

# Start MySQL environment
make dev-up-mysql

# Run migrations
make migrate-up-mysql

# Start the engine
make run-mysql
```

### Option 2: PostgreSQL Setup (Advanced users)

```bash
# Start PostgreSQL environment
make dev-up-postgres

# Run migrations  
make migrate-up

# Start the engine
make run
```

### Option 3: One-Command Demo

```bash
./scripts/demo.sh
```

This script automatically sets up MySQL, creates sample workflows, and runs tests.

## 📋 Database Support

| Database | Version | Features | Connection String |
|----------|---------|----------|-------------------|
| **PostgreSQL** | 15+ | pgvector, JSONB | `postgres://user:pass@host:5432/db` |
| **MySQL** | 8.0+ | JSON, UUID | `mysql://user:pass@tcp(host:3306)/db` |

The engine automatically detects the database type from the connection string.

3. **Build and run the server**

**With PostgreSQL:**
```bash
make build
make run
```

**With MySQL:**
```bash
make build
make run-mysql
```

**With custom environment:**
```bash
# Copy and edit environment file
cp .env.mysql .env  # for MySQL
# OR
cp .env.development .env  # for PostgreSQL

make run-with-env
```

4. **Access the services**
- API Server: http://localhost:8080
- Database Admin (Adminer): http://localhost:8081
- Metrics: http://localhost:8080/metrics

### Database Support

#### Supported Databases
- ✅ **PostgreSQL 15+** with pgvector extension
- ✅ **MySQL 8.0+** with JSON support
- 🔄 **Auto-detection** based on connection string

#### Connection Formats
```bash
# PostgreSQL
DATABASE_URL="postgres://user:password@localhost:5432/workflow_engine?sslmode=disable"

# MySQL  
DATABASE_URL="mysql://user:password@tcp(localhost:3306)/workflow_engine?parseTime=true"
```

See [MySQL Setup Guide](docs/MYSQL_SETUP.md) for detailed MySQL configuration.

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/yourusername/workflow-engine.git
cd workflow-engine

# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# Access the UI at http://localhost:3000
```

### Manual Installation

```bash
# Install dependencies
go mod download
cd web && npm install && cd ..

# Run database migrations
make migrate-up

# Build the project
make build

# Start the server
./bin/server

# Start workers (in another terminal)
./bin/worker
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API Server │────▶│  PostgreSQL │
│   (React)   │     │    (Gin)    │     │  + pgvector │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    Redis    │────▶│   Workers   │
                    │   (Queue)   │     │     (Go)    │
                    └─────────────┘     └─────────────┘
```

## Node Types

- **HTTP**: Make HTTP requests to any API
- **Transform**: JavaScript code execution
- **Database**: Query PostgreSQL, MySQL, MongoDB
- **Conditional**: If/then branching logic
- **Loop**: Iterate over arrays
- **Parallel**: Execute multiple paths simultaneously
- **AI Agent**: LLM-powered agents with tools
- **Sub-workflow**: Modular workflow composition
- **Email**: Send emails via SMTP
- **Slack**: Send messages to Slack
- **S3**: Upload/download files from S3
- **And 40+ more...**

## Documentation

- [Getting Started](docs/getting-started.md)
- [API Documentation](docs/api.md)
- [Node Reference](docs/nodes.md)
- [Deployment Guide](docs/deployment.md)
- [AI Integration](docs/ai-integration.md)

## Performance

Benchmarked on AWS c5.2xlarge:
- 10,000+ workflows/second
- Sub-10ms execution latency
- Horizontal scaling to millions of workflows

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://docs.workflow-engine.io)
- 💬 [Discord Community](https://discord.gg/workflow-engine)
- 🐛 [Issue Tracker](https://github.com/yourusername/workflow-engine/issues)

---

Built with ❤️ by the Workflow Engine Team
