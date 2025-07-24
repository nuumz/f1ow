.PHONY: all build test clean docker-build dev dev-up dev-down dev-logs run

VERSION ?= latest
REGISTRY ?= your-registry.io
IMAGE_PREFIX = ${REGISTRY}/f1ow

all: test build

build:
	@echo "Building server..."
	go build -o bin/server cmd/server/main.go
	@echo "Building worker..."
	go build -o bin/worker cmd/worker/main.go
	@echo "Build complete!"

test:
	go test -v ./tests/...

test-coverage:
	go test -v -race -coverprofile=coverage.out ./tests/...
	go tool cover -html=coverage.out -o coverage.html

clean:
	rm -rf bin/
	rm -rf coverage.*

# Development environment
dev-up:
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Development environment is ready!"
	@echo "PostgreSQL: localhost:5432 (user/password)"
	@echo "MySQL: localhost:3306 (user/password)"
	@echo "Redis: localhost:6379"
	@echo "Adminer: http://localhost:8081"

dev-up-postgres:
	docker-compose -f docker-compose.dev.yml up -d postgres redis adminer
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 10
	@echo "PostgreSQL environment is ready!"
	@echo "PostgreSQL: localhost:5432 (user/password)"
	@echo "Redis: localhost:6379"
	@echo "Adminer: http://localhost:8081"

dev-up-mysql:
	docker-compose -f docker-compose.dev.yml up -d mysql redis adminer
	@echo "Waiting for MySQL to be ready..."
	@sleep 10
	@echo "MySQL environment is ready!"
	@echo "MySQL: localhost:3306 (user/password)"
	@echo "Redis: localhost:6379"
	@echo "Adminer: http://localhost:8081"

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

run: build
	@echo "Running with .env configuration..."
	./bin/server

run-postgres: build
	@export DATABASE_URL="postgres://user:password@localhost:5432/f1ow?sslmode=disable" && \
	export REDIS_URL="redis://localhost:6379" && \
	export PORT="8080" && \
	export DEBUG="true" && \
	./bin/server

run-mysql: build
	@export DATABASE_URL="mysql://user:password@tcp(localhost:3306)/f1ow?parseTime=true" && \
	export REDIS_URL="redis://localhost:6379" && \
	export PORT="8080" && \
	export DEBUG="true" && \
	./bin/server

run-with-env: build
	@if [ -f .env ]; then export $$(cat .env | xargs); fi && \
	./bin/server

docker-build:
	docker build -f deployments/docker/Dockerfile.api -t ${IMAGE_PREFIX}/api:${VERSION} .
	docker build -f deployments/docker/Dockerfile.worker -t ${IMAGE_PREFIX}/worker:${VERSION} .
	cd web && docker build -f ../deployments/docker/Dockerfile.frontend -t ${IMAGE_PREFIX}/frontend:${VERSION} .

migrate-up:
	migrate -path ./migrations -database "$${DATABASE_URL}" up

migrate-down:
	migrate -path ./migrations -database "$${DATABASE_URL}" down

migrate-up-mysql:
	migrate -path ./migrations/mysql -database "mysql://user:password@tcp(localhost:3306)/f1ow" up

migrate-down-mysql:
	migrate -path ./migrations/mysql -database "mysql://user:password@tcp(localhost:3306)/f1ow" down
