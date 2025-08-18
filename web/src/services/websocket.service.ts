interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

interface ExecutionEvent {
  type: 'execution.started' | 'execution.completed' | 'execution.failed' | 'node.started' | 'node.completed' | 'node.failed'
  executionId: string
  workflowId: string
  nodeId?: string
  data?: any
  error?: string
}

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private isConnecting = false

  constructor() {
    this.connect()
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.isConnecting = true
    const wsUrl = (import.meta as any).env.VITE_WS_URL || 'ws://localhost:8080/ws'
    
    try {
      this.ws = new WebSocket(wsUrl)
      this.setupEventHandlers()
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      this.handleReconnect()
    }
  }

  private setupEventHandlers() {
    if (!this.ws) {return}

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.isConnecting = false
      this.reconnectAttempts = 0
      
      // Subscribe to channels
      this.send({
        type: 'subscribe',
        channels: ['executions', 'logs', 'system']
      })
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
      this.isConnecting = false
      this.ws = null
      
      if (!event.wasClean) {
        this.handleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.isConnecting = false
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    setTimeout(() => {
      this.connect()
    }, delay)
  }

  private handleMessage(message: WebSocketMessage) {
    const listeners = this.listeners.get(message.type)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(message.data)
        } catch (error) {
          console.error('Error in WebSocket message handler:', error)
        }
      })
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not connected, message not sent:', data)
    }
  }

  // Public API
  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  unsubscribe(eventType: string, callback?: (data: any) => void) {
    if (callback) {
      const listeners = this.listeners.get(eventType)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    } else {
      this.listeners.delete(eventType)
    }
  }

  // Execution monitoring
  subscribeToExecution(executionId: string, callback: (event: ExecutionEvent) => void) {
    const unsubscribeStarted = this.subscribe('execution.started', (data) => {
      if (data.executionId === executionId) {callback(data)}
    })
    
    const unsubscribeCompleted = this.subscribe('execution.completed', (data) => {
      if (data.executionId === executionId) {callback(data)}
    })
    
    const unsubscribeFailed = this.subscribe('execution.failed', (data) => {
      if (data.executionId === executionId) {callback(data)}
    })
    
    const unsubscribeNodeStarted = this.subscribe('node.started', (data) => {
      if (data.executionId === executionId) {callback(data)}
    })
    
    const unsubscribeNodeCompleted = this.subscribe('node.completed', (data) => {
      if (data.executionId === executionId) {callback(data)}
    })

    const unsubscribeNodeFailed = this.subscribe('node.failed', (data) => {
      if (data.executionId === executionId) {callback(data)}
    })

    // Return cleanup function
    return () => {
      unsubscribeStarted()
      unsubscribeCompleted()
      unsubscribeFailed()
      unsubscribeNodeStarted()
      unsubscribeNodeCompleted()
      unsubscribeNodeFailed()
    }
  }

  // Workflow updates
  subscribeToWorkflow(workflowId: string, callback: (event: any) => void) {
    return this.subscribe(`workflow.${workflowId}`, callback)
  }

  // System events
  subscribeToSystem(callback: (event: any) => void) {
    return this.subscribe('system', callback)
  }

  // Send execution commands
  startExecution(workflowId: string, input: any) {
    this.send({
      type: 'execution.start',
      workflowId,
      input
    })
  }

  cancelExecution(executionId: string) {
    this.send({
      type: 'execution.cancel',
      executionId
    })
  }

  // Get connection status
  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  get connectionState() {
    if (!this.ws) {return 'disconnected'}
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
        return 'closing'
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'unknown'
    }
  }

  // Manual reconnection
  reconnect() {
    if (this.ws) {
      this.ws.close()
    }
    this.reconnectAttempts = 0
    this.connect()
  }

  // Cleanup
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
    }
    this.listeners.clear()
  }
}

// Create singleton instance
export const websocketService = new WebSocketService()
export default websocketService