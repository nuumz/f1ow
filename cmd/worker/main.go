package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nuumz/f1ow/internal/engine"
	"github.com/nuumz/f1ow/internal/nodes"
	"github.com/nuumz/f1ow/internal/storage"
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	// Initialize configuration
	databaseURL := getEnv("DATABASE_URL", "postgres://user:password@localhost/workflow_engine?sslmode=disable")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379")

	log.Println("Starting workflow engine worker...")

	// Initialize database
	db, err := storage.NewDB(databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis
	redis, err := storage.NewRedisClient(redisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redis.Close()

	// Initialize workflow engine
	eng := engine.NewEngine(db, redis)

	// Register built-in node types
	registerNodeTypes(eng)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start worker
	go func() {
		log.Println("Worker started, listening for workflows...")
		if err := eng.StartWorker(ctx); err != nil {
			log.Printf("Worker error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down worker...")

	// Graceful shutdown
	cancel()

	// Wait a bit for graceful shutdown
	time.Sleep(2 * time.Second)

	log.Println("Worker stopped")
}

func registerNodeTypes(eng *engine.Engine) {
	// Register built-in node types
	eng.RegisterNode("http", &nodes.HTTPNode{})
	eng.RegisterNode("transform", &nodes.TransformNode{})
	eng.RegisterNode("conditional", &nodes.ConditionalNode{})
	eng.RegisterNode("loop", &nodes.LoopNode{})
	eng.RegisterNode("parallel", &nodes.ParallelNode{})

	log.Println("Registered built-in node types")
}
