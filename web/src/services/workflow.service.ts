import { api } from './api'

export interface WorkflowNode {
  id: string
  type: string
  position: {
    x: number
    y: number
  }
  config?: Record<string, unknown>
  data?: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface Workflow {
  id?: string
  name: string
  description?: string
  definition: {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
  }
}

export interface WorkflowExecutionInput {
  [key: string]: unknown
}

export interface WorkflowExecutionResult {
  id: string
  executionId?: string
  status: 'running' | 'completed' | 'failed'
  result?: Record<string, unknown>
  error?: string
  startTime: string
  endTime?: string
}

export const WorkflowService = {
  async getAll(): Promise<Workflow[]> {
    const response = await api.get('/workflows')
    return response.data
  },

  async getById(id: string): Promise<Workflow> {
    const response = await api.get(`/workflows/${id}`)
    return response.data
  },

  async create(workflow: Workflow): Promise<Workflow> {
    const response = await api.post('/workflows', workflow)
    return response.data
  },

  async update(id: string, workflow: Workflow): Promise<Workflow> {
    const response = await api.put(`/workflows/${id}`, workflow)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/workflows/${id}`)
  },

  async execute(id: string, input: WorkflowExecutionInput): Promise<WorkflowExecutionResult> {
    const response = await api.post(`/workflows/${id}/execute`, input)
    return response.data
  },
}
