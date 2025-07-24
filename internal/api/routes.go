package api

import (
	"strconv"

	"github.com/nuumz/f1ow/internal/engine"
	"github.com/nuumz/f1ow/internal/models"
	"github.com/nuumz/f1ow/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func SetupRoutes(router *gin.Engine, eng *engine.Engine, db *storage.DB, redis *storage.RedisClient) {
	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy",
			"services": gin.H{
				"database": db.Ping() == nil,
				"redis":    redis.Ping() == nil,
			},
		})
	})

	api := router.Group("/api/v1")
	{
		// Workflow routes
		api.GET("/workflows", GetWorkflows(db))
		api.POST("/workflows", CreateWorkflow(db))
		api.GET("/workflows/:id", GetWorkflow(db))
		api.PUT("/workflows/:id", UpdateWorkflow(db))
		api.DELETE("/workflows/:id", DeleteWorkflow(db))

		// Execution routes
		api.POST("/workflows/:id/execute", ExecuteWorkflow(eng))
		api.GET("/executions", GetExecutions(db))
		api.GET("/executions/:id", GetExecution(db))

		// Node routes
		api.GET("/nodes", GetAvailableNodes(eng))
		api.GET("/nodes/:type/schema", GetNodeSchema(eng))
	}

	// WebSocket for real-time updates
	router.GET("/ws", HandleWebSocket())
}

func GetWorkflows(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		workflows, err := db.GetWorkflows(c.Request.Context())
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, workflows)
	}
}

func CreateWorkflow(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var workflow models.Workflow
		if err := c.ShouldBindJSON(&workflow); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		// TODO: Get user ID from JWT token
		workflow.UserID = uuid.New() // Placeholder

		if err := db.CreateWorkflow(c.Request.Context(), &workflow); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(201, workflow)
	}
}

func GetWorkflow(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid workflow ID"})
			return
		}

		workflow, err := db.GetWorkflow(c.Request.Context(), id)
		if err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, workflow)
	}
}

func UpdateWorkflow(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid workflow ID"})
			return
		}

		var workflow models.Workflow
		if err := c.ShouldBindJSON(&workflow); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		workflow.ID = id
		if err := db.UpdateWorkflow(c.Request.Context(), &workflow); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, workflow)
	}
}

func DeleteWorkflow(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid workflow ID"})
			return
		}

		if err := db.DeleteWorkflow(c.Request.Context(), id); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, gin.H{"message": "workflow deleted"})
	}
}

func ExecuteWorkflow(eng *engine.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid workflow ID"})
			return
		}

		var input map[string]interface{}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		result, err := eng.Execute(c.Request.Context(), id.String(), input)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, result)
	}
}

func GetExecutions(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var workflowID *uuid.UUID
		var status *models.ExecutionStatus

		if wfIDStr := c.Query("workflow_id"); wfIDStr != "" {
			if wfID, err := uuid.Parse(wfIDStr); err == nil {
				workflowID = &wfID
			}
		}

		if statusStr := c.Query("status"); statusStr != "" {
			s := models.ExecutionStatus(statusStr)
			status = &s
		}

		limit := 100
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil {
				limit = l
			}
		}

		executions, err := db.GetExecutions(c.Request.Context(), workflowID, status, limit)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, executions)
	}
}

func GetExecution(db *storage.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid execution ID"})
			return
		}

		execution, err := db.GetExecution(c.Request.Context(), id)
		if err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, execution)
	}
}

func GetAvailableNodes(eng *engine.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodes := eng.GetAvailableNodes()

		nodeList := make([]gin.H, 0, len(nodes))
		for nodeType, node := range nodes {
			nodeList = append(nodeList, gin.H{
				"type":        nodeType,
				"name":        node.Name(),
				"description": node.Description(),
				"category":    node.Category(),
				"icon":        node.Icon(),
			})
		}

		c.JSON(200, gin.H{
			"nodes": nodeList,
		})
	}
}

func GetNodeSchema(eng *engine.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		nodeType := c.Param("type")

		schema, err := eng.GetNodeSchema(nodeType)
		if err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, schema)
	}
}

func HandleWebSocket() gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: Implement WebSocket handler
		c.JSON(501, gin.H{"error": "WebSocket not implemented yet"})
	}
}
