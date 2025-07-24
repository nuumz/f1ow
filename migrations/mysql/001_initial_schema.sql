-- MySQL Schema for Workflow Engine

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSON NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workflow_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    input JSON,
    output JSON,
    error TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    metadata JSON DEFAULT ('{}'),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Sub-workflow relationships
CREATE TABLE IF NOT EXISTS workflow_relationships (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    parent_workflow_id VARCHAR(36) NOT NULL,
    child_workflow_id VARCHAR(36) NOT NULL,
    node_id VARCHAR(255) NOT NULL,
    node_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_workflow_relationship (parent_workflow_id, child_workflow_id, node_id),
    FOREIGN KEY (parent_workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (child_workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_is_active ON workflows(is_active);
CREATE INDEX idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_started_at ON executions(started_at);
CREATE INDEX idx_workflow_relationships_parent ON workflow_relationships(parent_workflow_id);
CREATE INDEX idx_workflow_relationships_child ON workflow_relationships(child_workflow_id);
