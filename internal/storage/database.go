package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/nuumz/f1ow/internal/models"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

type DB struct {
	*sqlx.DB
	driverName string
}

func NewDB(dsn string) (*DB, error) {
	var driverName string

	// Auto-detect database driver based on DSN
	if strings.Contains(dsn, "postgres://") || strings.Contains(dsn, "postgresql://") {
		driverName = "postgres"
	} else if strings.Contains(dsn, "mysql://") || strings.Contains(dsn, "@tcp(") {
		driverName = "mysql"
		// Convert mysql:// format to go-sql-driver format
		if after, ok := strings.CutPrefix(dsn, "mysql://"); ok {
			dsn = after
		}
	} else {
		// Default to postgres for backward compatibility
		driverName = "postgres"
	}

	db, err := sqlx.Connect(driverName, dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	return &DB{db, driverName}, nil
}

func (db *DB) Ping() error {
	return db.DB.Ping()
}

func (db *DB) Close() error {
	return db.DB.Close()
}

// Helper functions for database-specific operations
func (db *DB) isMySQL() bool {
	return db.driverName == "mysql"
}

func (db *DB) isPostgreSQL() bool {
	return db.driverName == "postgres"
}

// Returns appropriate placeholder for parameter binding
func (db *DB) placeholder(n int) string {
	if db.isMySQL() {
		return "?"
	}
	return fmt.Sprintf("$%d", n)
}

// Returns appropriate UUID generation for the database
func (db *DB) generateUUID() string {
	if db.isMySQL() {
		// MySQL uses UUID() function or we can generate in Go
		return uuid.New().String()
	}
	// PostgreSQL can use uuid_generate_v4() or generate in Go
	return uuid.New().String()
}

// Workflow operations
func (db *DB) GetWorkflows(ctx context.Context) ([]models.Workflow, error) {
	var workflows []models.Workflow
	query := `
        SELECT id, name, description, definition, user_id, is_active, 
               created_at, updated_at, COALESCE(tags, '[]'), version, COALESCE(metadata, '{}')
        FROM workflows
        WHERE is_active = true
        ORDER BY created_at DESC
    `

	rows, err := db.QueryxContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var workflow models.Workflow
		var definitionJSON []byte
		var tagsJSON []byte
		var metadataJSON []byte

		err := rows.Scan(&workflow.ID, &workflow.Name, &workflow.Description,
			&definitionJSON, &workflow.UserID, &workflow.IsActive,
			&workflow.CreatedAt, &workflow.UpdatedAt, &tagsJSON,
			&workflow.Version, &metadataJSON)
		if err != nil {
			return nil, err
		}

		// Parse JSON fields
		if err := json.Unmarshal(definitionJSON, &workflow.Definition); err != nil {
			return nil, fmt.Errorf("failed to parse workflow definition: %w", err)
		}

		if len(tagsJSON) > 0 {
			if err := json.Unmarshal(tagsJSON, &workflow.Tags); err != nil {
				return nil, fmt.Errorf("failed to parse tags: %w", err)
			}
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &workflow.Metadata); err != nil {
				return nil, fmt.Errorf("failed to parse metadata: %w", err)
			}
		}

		workflows = append(workflows, workflow)
	}

	return workflows, rows.Err()
}

func (db *DB) GetWorkflow(ctx context.Context, id uuid.UUID) (*models.Workflow, error) {
	var workflow models.Workflow
	var definitionJSON []byte
	var tagsJSON []byte
	var metadataJSON []byte

	query := `
        SELECT id, name, description, definition, user_id, is_active, 
               created_at, updated_at, COALESCE(tags, '[]'), version, COALESCE(metadata, '{}')
        FROM workflows
        WHERE id = $1
    `

	err := db.QueryRowxContext(ctx, query, id).Scan(
		&workflow.ID, &workflow.Name, &workflow.Description,
		&definitionJSON, &workflow.UserID, &workflow.IsActive,
		&workflow.CreatedAt, &workflow.UpdatedAt, &tagsJSON,
		&workflow.Version, &metadataJSON)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("workflow not found")
		}
		return nil, err
	}

	// Parse JSON fields
	if err := json.Unmarshal(definitionJSON, &workflow.Definition); err != nil {
		return nil, fmt.Errorf("failed to parse workflow definition: %w", err)
	}

	if len(tagsJSON) > 0 {
		if err := json.Unmarshal(tagsJSON, &workflow.Tags); err != nil {
			return nil, fmt.Errorf("failed to parse tags: %w", err)
		}
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &workflow.Metadata); err != nil {
			return nil, fmt.Errorf("failed to parse metadata: %w", err)
		}
	}

	return &workflow, nil
}

func (db *DB) CreateWorkflow(ctx context.Context, workflow *models.Workflow) error {
	// Generate ID if not set
	if workflow.ID == uuid.Nil {
		workflow.ID = uuid.New()
	}

	// Set timestamps
	now := time.Now()
	workflow.CreatedAt = now
	workflow.UpdatedAt = now
	workflow.Version = 1

	// Marshal JSON fields
	definitionJSON, err := json.Marshal(workflow.Definition)
	if err != nil {
		return fmt.Errorf("failed to marshal definition: %w", err)
	}

	tagsJSON, err := json.Marshal(workflow.Tags)
	if err != nil {
		return fmt.Errorf("failed to marshal tags: %w", err)
	}

	metadataJSON, err := json.Marshal(workflow.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
        INSERT INTO workflows (id, name, description, definition, user_id, is_active, 
                              created_at, updated_at, tags, version, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `

	_, err = db.ExecContext(ctx, query, workflow.ID, workflow.Name, workflow.Description,
		definitionJSON, workflow.UserID, workflow.IsActive,
		workflow.CreatedAt, workflow.UpdatedAt, tagsJSON,
		workflow.Version, metadataJSON)

	return err
}

func (db *DB) UpdateWorkflow(ctx context.Context, workflow *models.Workflow) error {
	workflow.UpdatedAt = time.Now()
	workflow.Version++

	// Marshal JSON fields
	definitionJSON, err := json.Marshal(workflow.Definition)
	if err != nil {
		return fmt.Errorf("failed to marshal definition: %w", err)
	}

	tagsJSON, err := json.Marshal(workflow.Tags)
	if err != nil {
		return fmt.Errorf("failed to marshal tags: %w", err)
	}

	metadataJSON, err := json.Marshal(workflow.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
        UPDATE workflows 
        SET name = $2, description = $3, definition = $4, is_active = $5,
            updated_at = $6, tags = $7, version = $8, metadata = $9
        WHERE id = $1
    `

	result, err := db.ExecContext(ctx, query, workflow.ID, workflow.Name, workflow.Description,
		definitionJSON, workflow.IsActive, workflow.UpdatedAt,
		tagsJSON, workflow.Version, metadataJSON)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("workflow not found")
	}

	return nil
}

func (db *DB) DeleteWorkflow(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE workflows SET is_active = false WHERE id = $1`

	result, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("workflow not found")
	}

	return nil
}

// Execution operations
func (db *DB) CreateExecution(ctx context.Context, execution *models.Execution) error {
	if execution.ID == uuid.Nil {
		execution.ID = uuid.New()
	}

	execution.StartedAt = time.Now()

	// Marshal JSON fields
	inputJSON, err := json.Marshal(execution.Input)
	if err != nil {
		return fmt.Errorf("failed to marshal input: %w", err)
	}

	outputJSON, err := json.Marshal(execution.Output)
	if err != nil {
		return fmt.Errorf("failed to marshal output: %w", err)
	}

	metadataJSON, err := json.Marshal(execution.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	contextJSON, err := json.Marshal(execution.Context)
	if err != nil {
		return fmt.Errorf("failed to marshal context: %w", err)
	}

	query := `
        INSERT INTO executions (id, workflow_id, status, input, output, error,
                               started_at, completed_at, metadata, context)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `

	_, err = db.ExecContext(ctx, query, execution.ID, execution.WorkflowID, execution.Status,
		inputJSON, outputJSON, execution.Error, execution.StartedAt,
		execution.CompletedAt, metadataJSON, contextJSON)

	return err
}

func (db *DB) UpdateExecution(ctx context.Context, execution *models.Execution) error {
	// Marshal JSON fields
	outputJSON, err := json.Marshal(execution.Output)
	if err != nil {
		return fmt.Errorf("failed to marshal output: %w", err)
	}

	metadataJSON, err := json.Marshal(execution.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	contextJSON, err := json.Marshal(execution.Context)
	if err != nil {
		return fmt.Errorf("failed to marshal context: %w", err)
	}

	query := `
        UPDATE executions 
        SET status = $2, output = $3, error = $4, completed_at = $5, 
            metadata = $6, context = $7
        WHERE id = $1
    `

	_, err = db.ExecContext(ctx, query, execution.ID, execution.Status, outputJSON,
		execution.Error, execution.CompletedAt, metadataJSON, contextJSON)

	return err
}

func (db *DB) GetExecution(ctx context.Context, id uuid.UUID) (*models.Execution, error) {
	var execution models.Execution
	var inputJSON, outputJSON, metadataJSON, contextJSON []byte

	query := `
        SELECT id, workflow_id, status, input, output, error,
               started_at, completed_at, metadata, context
        FROM executions
        WHERE id = $1
    `

	err := db.QueryRowxContext(ctx, query, id).Scan(
		&execution.ID, &execution.WorkflowID, &execution.Status,
		&inputJSON, &outputJSON, &execution.Error,
		&execution.StartedAt, &execution.CompletedAt,
		&metadataJSON, &contextJSON)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("execution not found")
		}
		return nil, err
	}

	// Parse JSON fields
	if len(inputJSON) > 0 {
		if err := json.Unmarshal(inputJSON, &execution.Input); err != nil {
			return nil, fmt.Errorf("failed to parse input: %w", err)
		}
	}

	if len(outputJSON) > 0 {
		if err := json.Unmarshal(outputJSON, &execution.Output); err != nil {
			return nil, fmt.Errorf("failed to parse output: %w", err)
		}
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &execution.Metadata); err != nil {
			return nil, fmt.Errorf("failed to parse metadata: %w", err)
		}
	}

	if len(contextJSON) > 0 {
		if err := json.Unmarshal(contextJSON, &execution.Context); err != nil {
			return nil, fmt.Errorf("failed to parse context: %w", err)
		}
	}

	return &execution, nil
}

// GetExecutions retrieves executions with optional filtering
func (db *DB) GetExecutions(ctx context.Context, workflowID *uuid.UUID, status *models.ExecutionStatus, limit int) ([]models.Execution, error) {
	query := `
        SELECT id, workflow_id, status, input, output, error,
               started_at, completed_at, metadata, context
        FROM executions
        WHERE 1=1
    `
	args := []interface{}{}
	argIndex := 1

	if workflowID != nil {
		query += fmt.Sprintf(" AND workflow_id = $%d", argIndex)
		args = append(args, *workflowID)
		argIndex++
	}

	if status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, *status)
		argIndex++
	}

	query += " ORDER BY started_at DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, limit)
	}

	rows, err := db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var executions []models.Execution
	for rows.Next() {
		var execution models.Execution
		var inputJSON, outputJSON, metadataJSON, contextJSON []byte

		err := rows.Scan(
			&execution.ID, &execution.WorkflowID, &execution.Status,
			&inputJSON, &outputJSON, &execution.Error,
			&execution.StartedAt, &execution.CompletedAt,
			&metadataJSON, &contextJSON)
		if err != nil {
			return nil, err
		}

		// Parse JSON fields
		if len(inputJSON) > 0 {
			json.Unmarshal(inputJSON, &execution.Input)
		}
		if len(outputJSON) > 0 {
			json.Unmarshal(outputJSON, &execution.Output)
		}
		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &execution.Metadata)
		}
		if len(contextJSON) > 0 {
			json.Unmarshal(contextJSON, &execution.Context)
		}

		executions = append(executions, execution)
	}

	return executions, rows.Err()
}
