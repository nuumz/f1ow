package storage

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client     redis.Cmdable
	realClient redis.UniversalClient // For Close() and Subscribe()
}

// RedisConfig holds Redis configuration options
type RedisConfig struct {
	// Standard Redis
	URL string

	// Sentinel Configuration
	UseSentinel      bool
	SentinelAddrs    []string
	MasterName       string
	SentinelPassword string

	// Common options
	Password string
	DB       int
}

// NewRedisClient creates a new Redis client with optional Sentinel support
func NewRedisClient(url string) (*RedisClient, error) {
	config, err := ParseRedisURL(url)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	var client redis.Cmdable
	var realClient redis.UniversalClient

	if config.UseSentinel {
		// Create Sentinel client
		sentinelOpt := &redis.FailoverOptions{
			MasterName:       config.MasterName,
			SentinelAddrs:    config.SentinelAddrs,
			SentinelPassword: config.SentinelPassword,
			Password:         config.Password,
			DB:               config.DB,
		}
		failoverClient := redis.NewFailoverClient(sentinelOpt)
		client = failoverClient
		realClient = failoverClient
	} else {
		// Create standard Redis client
		opt, err := redis.ParseURL(config.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse redis URL: %w", err)
		}
		redisClient := redis.NewClient(opt)
		client = redisClient
		realClient = redisClient
	}

	// Test connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &RedisClient{
		client:     client,
		realClient: realClient,
	}, nil
}

// parseRedisURL parses Redis URL and extracts configuration
func ParseRedisURL(redisURL string) (*RedisConfig, error) {
	config := &RedisConfig{
		URL: redisURL,
		DB:  0,
	}

	// Check if it's a sentinel URL
	if strings.HasPrefix(redisURL, "redis-sentinel://") {
		return ParseSentinelURL(redisURL)
	}

	// Standard Redis URL
	return config, nil
}

// parseSentinelURL parses Redis Sentinel URL format:
// redis-sentinel://[password@]host:port,host:port/master-name[?db=0&password=xxx]
func ParseSentinelURL(redisURL string) (*RedisConfig, error) {
	config := &RedisConfig{
		UseSentinel: true,
		DB:          0,
	}

	// Remove redis-sentinel:// prefix
	urlStr := strings.TrimPrefix(redisURL, "redis-sentinel://")

	// Parse URL components
	u, err := url.Parse("redis://" + urlStr)
	if err != nil {
		return nil, fmt.Errorf("invalid sentinel URL format: %w", err)
	}

	// Extract password
	if u.User != nil {
		// If there's no password, username becomes the password
		if pwd, set := u.User.Password(); set {
			config.Password = pwd
		} else {
			config.Password = u.User.Username()
		}
	}

	// Extract master name from path
	if u.Path != "" {
		config.MasterName = strings.TrimPrefix(u.Path, "/")
	} else {
		config.MasterName = "mymaster" // default
	}

	// Extract sentinel addresses from host
	if u.Host != "" {
		config.SentinelAddrs = strings.Split(u.Host, ",")
	}

	// Parse query parameters
	query := u.Query()
	if dbStr := query.Get("db"); dbStr != "" {
		if db, err := strconv.Atoi(dbStr); err == nil {
			config.DB = db
		}
	}
	if sentinelPwd := query.Get("password"); sentinelPwd != "" {
		config.SentinelPassword = sentinelPwd
	}

	return config, nil
}

func (r *RedisClient) Client() redis.Cmdable {
	return r.client
}

func (r *RedisClient) Ping() error {
	return r.client.Ping(context.Background()).Err()
}

func (r *RedisClient) Close() error {
	return r.realClient.Close()
}

func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return r.client.Set(ctx, key, value, expiration).Err()
}

func (r *RedisClient) Delete(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

func (r *RedisClient) Publish(ctx context.Context, channel string, message interface{}) error {
	return r.client.Publish(ctx, channel, message).Err()
}

func (r *RedisClient) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return r.realClient.Subscribe(ctx, channels...)
}

// GetUniversalClient returns the underlying Redis client for advanced operations
func (r *RedisClient) GetUniversalClient() redis.UniversalClient {
	return r.realClient
}
