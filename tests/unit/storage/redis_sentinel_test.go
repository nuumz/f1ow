package storage

import (
	"testing"

	"workflow-engine/internal/storage"

	"github.com/stretchr/testify/assert"
)

func TestParseRedisURL(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		expected    *storage.RedisConfig
		expectError bool
	}{
		{
			name: "standard redis url",
			url:  "redis://localhost:6379",
			expected: &storage.RedisConfig{
				URL:         "redis://localhost:6379",
				UseSentinel: false,
				DB:          0,
			},
			expectError: false,
		},
		{
			name: "basic sentinel url",
			url:  "redis-sentinel://localhost:26379/mymaster",
			expected: &storage.RedisConfig{
				UseSentinel:   true,
				SentinelAddrs: []string{"localhost:26379"},
				MasterName:    "mymaster",
				DB:            0,
			},
			expectError: false,
		},
		{
			name: "multiple sentinel hosts",
			url:  "redis-sentinel://host1:26379,host2:26379,host3:26379/mymaster",
			expected: &storage.RedisConfig{
				UseSentinel:   true,
				SentinelAddrs: []string{"host1:26379", "host2:26379", "host3:26379"},
				MasterName:    "mymaster",
				DB:            0,
			},
			expectError: false,
		},
		{
			name: "sentinel with password",
			url:  "redis-sentinel://mypass@host1:26379,host2:26379/mymaster",
			expected: &storage.RedisConfig{
				UseSentinel:   true,
				SentinelAddrs: []string{"host1:26379", "host2:26379"},
				MasterName:    "mymaster",
				Password:      "mypass",
				DB:            0,
			},
			expectError: false,
		},
		{
			name: "sentinel with db and sentinel password",
			url:  "redis-sentinel://mypass@host1:26379/mymaster?db=2&password=sentinelpass",
			expected: &storage.RedisConfig{
				UseSentinel:      true,
				SentinelAddrs:    []string{"host1:26379"},
				MasterName:       "mymaster",
				Password:         "mypass",
				SentinelPassword: "sentinelpass",
				DB:               2,
			},
			expectError: false,
		},
		{
			name: "sentinel default master name",
			url:  "redis-sentinel://host1:26379,host2:26379",
			expected: &storage.RedisConfig{
				UseSentinel:   true,
				SentinelAddrs: []string{"host1:26379", "host2:26379"},
				MasterName:    "mymaster",
				DB:            0,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := storage.ParseRedisURL(tt.url)

			if tt.expectError {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expected.UseSentinel, config.UseSentinel)
			assert.Equal(t, tt.expected.MasterName, config.MasterName)
			assert.Equal(t, tt.expected.Password, config.Password)
			assert.Equal(t, tt.expected.SentinelPassword, config.SentinelPassword)
			assert.Equal(t, tt.expected.DB, config.DB)
			assert.Equal(t, tt.expected.SentinelAddrs, config.SentinelAddrs)

			if !tt.expected.UseSentinel {
				assert.Equal(t, tt.expected.URL, config.URL)
			}
		})
	}
}

func TestParseSentinelURL(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		expected    *storage.RedisConfig
		expectError bool
	}{
		{
			name: "minimal sentinel url",
			url:  "redis-sentinel://localhost:26379/mymaster",
			expected: &storage.RedisConfig{
				UseSentinel:   true,
				SentinelAddrs: []string{"localhost:26379"},
				MasterName:    "mymaster",
				DB:            0,
			},
			expectError: false,
		},
		{
			name: "complex sentinel url",
			url:  "redis-sentinel://user:pass@host1:26379,host2:26380,host3:26381/production-master?db=3&password=spass",
			expected: &storage.RedisConfig{
				UseSentinel:      true,
				SentinelAddrs:    []string{"host1:26379", "host2:26380", "host3:26381"},
				MasterName:       "production-master",
				Password:         "pass",
				SentinelPassword: "spass",
				DB:               3,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := storage.ParseSentinelURL(tt.url)

			if tt.expectError {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expected.UseSentinel, config.UseSentinel)
			assert.Equal(t, tt.expected.SentinelAddrs, config.SentinelAddrs)
			assert.Equal(t, tt.expected.MasterName, config.MasterName)
			assert.Equal(t, tt.expected.Password, config.Password)
			assert.Equal(t, tt.expected.SentinelPassword, config.SentinelPassword)
			assert.Equal(t, tt.expected.DB, config.DB)
		})
	}
}

// Test Redis connection creation (without actual connection)
func TestRedisClientCreation(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		expectError bool
	}{
		{
			name:        "standard redis url",
			url:         "redis://localhost:6379",
			expectError: true, // Will fail connection, but that's expected in test
		},
		{
			name:        "sentinel url",
			url:         "redis-sentinel://localhost:26379/mymaster",
			expectError: true, // Will fail connection, but that's expected in test
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := storage.NewRedisClient(tt.url)

			// We expect connection errors in tests since Redis isn't running
			// But we want to make sure URL parsing works
			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "failed to connect to redis")
			}
		})
	}
}
