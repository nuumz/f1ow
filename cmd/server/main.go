package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"workflow-engine/internal/api"
	"workflow-engine/internal/engine"
	"workflow-engine/internal/nodes"
	"workflow-engine/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	Debug       bool
}

func main() {
	// Load .env file if it exists
	log.Println("Loading .env files...")
	if err := godotenv.Load(); err != nil {
		log.Printf("Could not load .env file: %v", err)
		// Try loading common .env files
		if err2 := godotenv.Load(".env.development"); err2 != nil {
			log.Printf("Could not load .env.development: %v", err2)
		}
		if err3 := godotenv.Load(".env.mysql"); err3 != nil {
			log.Printf("Could not load .env.mysql: %v", err3)
		}
		// Don't fail if .env files don't exist - just use environment variables
	} else {
		log.Println("Successfully loaded .env file")
	}

	// Initialize configuration
	config := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://user:password@localhost/workflow_engine?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		Debug:       getEnv("DEBUG", "false") == "true",
	}

	log.Printf("Raw DATABASE_URL from env: %s", os.Getenv("DATABASE_URL"))
	log.Printf("Starting workflow engine on port %s", config.Port)
	log.Printf("Database URL: %s", maskPassword(config.DatabaseURL))
	log.Printf("Redis URL: %s", config.RedisURL)
	log.Printf("Debug mode: %v", config.Debug)

	// Initialize database
	db, err := storage.NewDB(config.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis
	redis, err := storage.NewRedisClient(config.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redis.Close()

	// Initialize workflow engine
	eng := engine.NewEngine(db, redis)

	// Register built-in node types
	registerNodeTypes(eng)

	// Initialize Gin router
	if !config.Debug {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Add CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Setup routes
	api.SetupRoutes(router, eng, db, redis)

	// Add metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Start server
	srv := &http.Server{
		Addr:    ":" + config.Port,
		Handler: router,
	}

	go func() {
		log.Printf("Server starting on port %s", config.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with
	// a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func maskPassword(url string) string {
	// Simple password masking for logging
	if len(url) == 0 {
		return url
	}
	// Find password part and replace with ***
	if idx := strings.Index(url, "://"); idx != -1 {
		if pwdIdx := strings.Index(url[idx:], ":"); pwdIdx != -1 {
			if atIdx := strings.Index(url[idx+pwdIdx:], "@"); atIdx != -1 {
				return url[:idx+pwdIdx+1] + "***" + url[idx+pwdIdx+atIdx:]
			}
		}
	}
	return url
}

func getDatabaseType(databaseURL string) string {
	if strings.HasPrefix(databaseURL, "mysql://") {
		return "mysql"
	}
	if strings.HasPrefix(databaseURL, "postgres://") {
		return "postgresql"
	}
	return "unknown"
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
