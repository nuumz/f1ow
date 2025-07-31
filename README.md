# f1ow

A high-performance, open-source workflow automation platform with AI capabilities, built with Go and React.

![Workflow Designer](https://raw.githubusercontent.com/nuumz/f1ow/main/docs/images/workflow-designer-screenshot.png)
*Visual workflow designer showing AI agent integration with HTTP requests and chat message triggers*

🌐 [f1ow.io](https://f1ow.io)

## ✨ Features

- 🚀 **High Performance**: Handle 10,000+ workflows/second
- 🤖 **AI-Native**: Built-in AI agent nodes with multi-agent orchestration  
- 🔄 **Sub-workflows**: Modular workflow composition and reusability
- 📊 **Visual Designer**: Interactive drag-and-drop workflow creation with real-time preview
- 🔌 **Rich Node Library**: HTTP requests, data transformations, conditionals, AI agents, and more
- 🗄️ **Multi-Database**: PostgreSQL & MySQL support with automatic detection
- 🏗️ **Cloud-Native**: Kubernetes-ready with Docker containers and horizontal scaling
- 📈 **Monitoring**: Built-in metrics with Prometheus integration
- 🔒 **Enterprise-Ready**: Authentication, credential management, and audit capabilities
- 📝 **100% Open Source**: MIT licensed with active community development

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
git clone https://github.com/nuumz/f1ow.git
cd f1ow

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
DATABASE_URL="postgres://user:password@localhost:5432/f1ow?sslmode=disable"

# MySQL  
DATABASE_URL="mysql://user:password@tcp(localhost:3306)/f1ow?parseTime=true"
```

See [MySQL Setup Guide](docs/MYSQL_SETUP.md) for detailed MySQL configuration.

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/nuumz/f1ow.git
cd f1ow

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

## 🖥 Frontend Development

The frontend is built with modern React and TypeScript, located in the `web/` directory:

```bash
# Navigate to frontend directory
cd web

# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Run tests
npm test
```

### Frontend Tech Stack
- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Full type safety throughout the application
- **Vite**: Fast build tool and development server
- **TanStack Router**: Type-safe routing with devtools
- **D3.js & Dagre**: Advanced graph visualization for workflow designer
- **Axios**: HTTP client for API communication
- **Lucide React**: Modern icon library

## 🏗 Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│    Frontend     │────▶│ API Server  │────▶│  Database   │
│ React + Vite +  │     │ (Go + Gin)  │     │ PostgreSQL  │
│ TypeScript      │     │             │     │ OR MySQL    │
└─────────────────┘     └─────────────┘     └─────────────┘
                               │
                               ▼
                        ┌─────────────┐     ┌─────────────┐
                        │    Redis    │────▶│   Workers   │
                        │   (Queue)   │     │   (Go)      │
                        └─────────────┘     └─────────────┘
```

### Key Components

- **Frontend**: React 18 + TypeScript + Vite with modern workflow designer
- **Backend**: Go with Gin framework for high-performance API
- **Database**: PostgreSQL or MySQL with auto-detection
- **Queue**: Redis for job scheduling and workflow execution
- **Workers**: Go-based workers for distributed execution
- **Monitoring**: Prometheus metrics and observability

## 🎨 Visual Workflow Designer

The f1ow workflow designer provides an intuitive drag-and-drop interface for building complex automation workflows:

### Designer Features
- **Node Palette**: Easy access to all node types including Start, HTTP Request, Set, IF, AI Agent, OpenAI, MySQL, Email, Schedule, JSON, and Sub-workflow nodes
- **Visual Canvas**: Interactive workspace with zoom, pan, and grid snapping
- **Smart Connections**: Automatic connection routing between nodes with visual feedback
- **Live Preview**: Real-time workflow validation and execution status
- **Auto-Save**: Automatic draft saving with version management
- **Multiple Styles**: Standard and compact node views for different workflow complexities

### Supported Node Types
- **Triggers**: Start nodes and scheduled triggers
- **Integrations**: HTTP requests, database queries, email sending
- **Logic**: Conditional branches, loops, and data transformations  
- **AI**: OpenAI integration and custom AI agent nodes
- **Data**: JSON processing, variable setting, and data mapping
- **Control Flow**: Sub-workflows and parallel execution paths

## 📋 Node Types Reference

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

## 📚 Documentation

- [Quick Start Guide](docs/QUICKSTART.md)
- [MySQL Setup Guide](docs/MYSQL_SETUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Workflow Engine Knowledge Base](docs/workflow-engine-knowledge.md)
- [MySQL Examples](docs/mysql-examples.md)
- [Redis Sentinel Setup](docs/redis-sentinel.md)

## 🛠 Development

### Project Structure
```
f1ow/
├── cmd/                    # Application entry points
│   ├── server/            # API server
│   └── worker/            # Background workers
├── internal/              # Private application code
│   ├── engine/           # Workflow execution engine
│   ├── nodes/            # Node type implementations
│   ├── storage/          # Database and Redis clients
│   └── api/              # REST API handlers
├── web/                   # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   └── services/     # API client services
├── migrations/           # Database schema migrations
├── deployments/         # Docker and Kubernetes manifests
├── examples/            # Sample workflow files
└── scripts/             # Development and deployment scripts
```

### Running Tests
```bash
# Run Go unit tests
make test

# Run integration tests
make test-integration

# Run frontend tests
cd web && npm test

# Run end-to-end tests
make test-e2e
```

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

- 📚 [Documentation](https://docs.f1ow.io)
- 💬 [Discord Community](https://discord.gg/f1ow)
- 🐛 [Issue Tracker](https://github.com/nuumz/f1ow/issues)

---

Built with ❤️ by the f1ow Team
