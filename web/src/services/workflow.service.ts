import { api } from './api'

export interface Workflow {
  id?: string
  name: string
  description?: string
  definition: {
    nodes: any[]
    edges: any[]
  }
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

  async execute(id: string, input: any): Promise<any> {
    const response = await api.post(`/workflows/${id}/execute`, input)
    return response.data
  },
}
