package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nuumz/f1ow/internal/storage"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// WorkQueue manages workflow execution jobs
type WorkQueue struct {
	redis    *storage.RedisClient
	queueKey string
}

// Job represents a workflow execution job
type Job struct {
	ID         string                 `json:"id"`
	WorkflowID string                 `json:"workflow_id"`
	Input      map[string]interface{} `json:"input"`
	Priority   int                    `json:"priority"`
	CreatedAt  time.Time              `json:"created_at"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// JobResult represents the result of a job execution
type JobResult struct {
	JobID    string                 `json:"job_id"`
	Status   string                 `json:"status"`
	Output   map[string]interface{} `json:"output"`
	Error    *string                `json:"error,omitempty"`
	Duration time.Duration          `json:"duration"`
}

// NewWorkQueue creates a new work queue
func NewWorkQueue(redis *storage.RedisClient) *WorkQueue {
	return &WorkQueue{
		redis:    redis,
		queueKey: "workflow:queue",
	}
}

// Enqueue adds a job to the queue
func (q *WorkQueue) Enqueue(ctx context.Context, job *Job) error {
	if job.ID == "" {
		job.ID = uuid.New().String()
	}
	job.CreatedAt = time.Now()

	// Serialize job
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	// Add to Redis sorted set with priority as score
	score := float64(job.Priority)
	if job.Priority == 0 {
		// Use timestamp for FIFO when no priority
		score = float64(time.Now().UnixNano())
	}

	client := q.redis.Client()
	err = client.ZAdd(ctx, q.queueKey, redis.Z{
		Score:  score,
		Member: string(data),
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to enqueue job: %w", err)
	}

	// Publish notification for workers
	err = client.Publish(ctx, "workflow:job:new", job.ID).Err()
	if err != nil {
		// Non-fatal, workers will still poll
		return nil
	}

	return nil
}

// Dequeue retrieves and removes the next job from the queue
func (q *WorkQueue) Dequeue(ctx context.Context) (*Job, error) {
	client := q.redis.Client()

	// Get highest priority job (lowest score)
	result, err := client.ZPopMin(ctx, q.queueKey, 1).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Empty queue
		}
		return nil, fmt.Errorf("failed to dequeue job: %w", err)
	}

	if len(result) == 0 {
		return nil, nil // Empty queue
	}

	// Deserialize job
	var job Job
	err = json.Unmarshal([]byte(result[0].Member.(string)), &job)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	return &job, nil
}

// Peek returns the next job without removing it
func (q *WorkQueue) Peek(ctx context.Context) (*Job, error) {
	client := q.redis.Client()

	// Get highest priority job without removing
	result, err := client.ZRangeWithScores(ctx, q.queueKey, 0, 0).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to peek job: %w", err)
	}

	if len(result) == 0 {
		return nil, nil // Empty queue
	}

	// Deserialize job
	var job Job
	err = json.Unmarshal([]byte(result[0].Member.(string)), &job)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	return &job, nil
}

// Size returns the number of jobs in the queue
func (q *WorkQueue) Size(ctx context.Context) (int64, error) {
	client := q.redis.Client()
	return client.ZCard(ctx, q.queueKey).Result()
}

// Clear removes all jobs from the queue
func (q *WorkQueue) Clear(ctx context.Context) error {
	client := q.redis.Client()
	return client.Del(ctx, q.queueKey).Err()
}

// GetDelayedQueue returns the key for delayed jobs
func (q *WorkQueue) GetDelayedQueue() string {
	return q.queueKey + ":delayed"
}

// ScheduleJob schedules a job for later execution
func (q *WorkQueue) ScheduleJob(ctx context.Context, job *Job, executeAt time.Time) error {
	if job.ID == "" {
		job.ID = uuid.New().String()
	}

	// Serialize job
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	// Add to delayed queue with execution time as score
	client := q.redis.Client()
	err = client.ZAdd(ctx, q.GetDelayedQueue(), redis.Z{
		Score:  float64(executeAt.Unix()),
		Member: string(data),
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to schedule job: %w", err)
	}

	return nil
}

// ProcessDelayedJobs moves ready delayed jobs to main queue
func (q *WorkQueue) ProcessDelayedJobs(ctx context.Context) error {
	client := q.redis.Client()
	now := time.Now().Unix()

	// Get all jobs that should be executed now
	result, err := client.ZRangeByScore(ctx, q.GetDelayedQueue(), &redis.ZRangeBy{
		Min: "0",
		Max: fmt.Sprintf("%d", now),
	}).Result()

	if err != nil {
		return fmt.Errorf("failed to get delayed jobs: %w", err)
	}

	// Move each job to main queue
	for _, data := range result {
		var job Job
		if err := json.Unmarshal([]byte(data), &job); err != nil {
			continue
		}

		// Add to main queue
		if err := q.Enqueue(ctx, &job); err != nil {
			continue
		}

		// Remove from delayed queue
		client.ZRem(ctx, q.GetDelayedQueue(), data)
	}

	return nil
}
