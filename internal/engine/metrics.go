package engine

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics
type Metrics struct {
	// Workflow metrics
	WorkflowsTotal     prometheus.Counter
	WorkflowsSucceeded prometheus.Counter
	WorkflowsFailed    prometheus.Counter
	WorkflowDuration   prometheus.Histogram
	ActiveWorkflows    prometheus.Gauge

	// Node metrics
	NodesExecuted         *prometheus.CounterVec
	NodeExecutionDuration *prometheus.HistogramVec
	NodeErrors            *prometheus.CounterVec

	// Queue metrics
	QueueSize         prometheus.Gauge
	JobsEnqueued      prometheus.Counter
	JobsDequeued      prometheus.Counter
	JobProcessingTime prometheus.Histogram

	// Worker metrics
	ActiveWorkers     prometheus.Gauge
	WorkerUtilization prometheus.Gauge

	// System metrics
	DatabaseConnections prometheus.Gauge
	RedisConnections    prometheus.Gauge
	APIRequestDuration  *prometheus.HistogramVec
	APIRequestTotal     *prometheus.CounterVec
}

// NewMetrics creates and registers all metrics
func NewMetrics() *Metrics {
	return &Metrics{
		// Workflow metrics
		WorkflowsTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "workflow_executions_total",
			Help: "Total number of workflow executions",
		}),

		WorkflowsSucceeded: promauto.NewCounter(prometheus.CounterOpts{
			Name: "workflow_executions_succeeded_total",
			Help: "Total number of successful workflow executions",
		}),

		WorkflowsFailed: promauto.NewCounter(prometheus.CounterOpts{
			Name: "workflow_executions_failed_total",
			Help: "Total number of failed workflow executions",
		}),

		WorkflowDuration: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "workflow_execution_duration_seconds",
			Help:    "Workflow execution duration in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300},
		}),

		ActiveWorkflows: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "workflow_executions_active",
			Help: "Number of currently active workflow executions",
		}),

		// Node metrics
		NodesExecuted: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "node_executions_total",
				Help: "Total number of node executions by type",
			},
			[]string{"node_type"},
		),

		NodeExecutionDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "node_execution_duration_seconds",
				Help:    "Node execution duration in seconds by type",
				Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"node_type"},
		),

		NodeErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "node_errors_total",
				Help: "Total number of node execution errors by type",
			},
			[]string{"node_type", "error_type"},
		),

		// Queue metrics
		QueueSize: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "queue_size",
			Help: "Current size of the job queue",
		}),

		JobsEnqueued: promauto.NewCounter(prometheus.CounterOpts{
			Name: "jobs_enqueued_total",
			Help: "Total number of jobs enqueued",
		}),

		JobsDequeued: promauto.NewCounter(prometheus.CounterOpts{
			Name: "jobs_dequeued_total",
			Help: "Total number of jobs dequeued",
		}),

		JobProcessingTime: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "job_processing_duration_seconds",
			Help:    "Job processing duration in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60},
		}),

		// Worker metrics
		ActiveWorkers: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "workers_active",
			Help: "Number of active workers",
		}),

		WorkerUtilization: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "worker_utilization_percentage",
			Help: "Worker utilization percentage",
		}),

		// System metrics
		DatabaseConnections: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "database_connections_active",
			Help: "Number of active database connections",
		}),

		RedisConnections: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "redis_connections_active",
			Help: "Number of active Redis connections",
		}),

		APIRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "api_request_duration_seconds",
				Help:    "API request duration in seconds",
				Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2.5, 5},
			},
			[]string{"method", "endpoint", "status"},
		),

		APIRequestTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "api_requests_total",
				Help: "Total number of API requests",
			},
			[]string{"method", "endpoint", "status"},
		),
	}
}

// RecordWorkflowExecution records a workflow execution
func (m *Metrics) RecordWorkflowExecution(duration time.Duration, success bool) {
	m.WorkflowsTotal.Inc()
	m.WorkflowDuration.Observe(duration.Seconds())

	if success {
		m.WorkflowsSucceeded.Inc()
	} else {
		m.WorkflowsFailed.Inc()
	}
}

// RecordNodeExecution records a node execution
func (m *Metrics) RecordNodeExecution(nodeType string, duration time.Duration) {
	m.NodesExecuted.WithLabelValues(nodeType).Inc()
	m.NodeExecutionDuration.WithLabelValues(nodeType).Observe(duration.Seconds())
}

// RecordAPIRequest records API request metrics
func (m *Metrics) RecordAPIRequest(method, endpoint, status string, duration time.Duration) {
	m.APIRequestTotal.WithLabelValues(method, endpoint, status).Inc()
	m.APIRequestDuration.WithLabelValues(method, endpoint, status).Observe(duration.Seconds())
}
