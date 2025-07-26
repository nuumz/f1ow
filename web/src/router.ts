import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import React from 'react'

// Component imports
import RootLayout from './components/RootLayout'
import Dashboard from './components/Dashboard'
import AdvancedWorkflowDesigner from './components/AdvancedWorkflowDesigner'
import WorkflowDesigner from './components/workflow-designer/WorkflowDesignerWithProvider'
import WorkflowList from './components/WorkflowList'
import ExecutionHistory from './components/ExecutionHistory'
import DataMapper from './components/DataMapper'
import WorkflowTemplates from './components/WorkflowTemplates'
import CredentialManager from './components/CredentialManager'
import WorkflowVersions from './components/WorkflowVersions'
import ExpressionEditor from './components/ExpressionEditor'

// Root route
const rootRoute = createRootRoute({
  component: RootLayout
})

// Dashboard route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard
})

// Workflows routes
const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows',
  component: WorkflowList
})

// Designer routes
const designerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/designer',
  component: WorkflowDesigner
})

const designerIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/designer/$id',
  component: WorkflowDesigner
})

// Legacy designer route for comparison
const designerLegacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/designer-legacy',
  component: AdvancedWorkflowDesigner
})

// Templates route
const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/templates',
  component: () => {
    return React.createElement(WorkflowTemplates, {
      onUseTemplate: (template: any) => console.log('Using template:', template)
    })
  }
})

// Credentials route
const credentialsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/credentials',
  component: CredentialManager
})

// Executions route
const executionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/executions',
  component: ExecutionHistory
})

// Version history route
const versionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/versions/$id',
  component: () => {
    return React.createElement(WorkflowVersions, {
      workflowId: 'test'
    })
  }
})

// Data mapper route
const mapperRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mapper',
  component: () => {
    return React.createElement(DataMapper, {
      sourceData: {},
      targetSchema: {},
      mappings: [],
    })
  }
})

// Expression editor route
const expressionEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expression-editor',
  component: () => {
    return React.createElement('div', 
      { style: { padding: '2rem' } },
      React.createElement(ExpressionEditor, {
        value: '',
        onChange: () => {},
        dataContext: {
          user: { name: 'John Doe', email: 'john@example.com' },
          items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }]
        },
        onTest: async (expr: string) => {
          try {
            return eval(expr)
          } catch (error) {
            throw new Error(`Expression error: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      })
    )
  }
})

// 404 Not Found route
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => {
    return React.createElement('div', 
      { 
        style: { 
          padding: '2rem', 
          textAlign: 'center',
          color: '#666'
        } 
      },
      React.createElement('h2', null, '404 - Page Not Found'),
      React.createElement('p', null, 'The page you are looking for does not exist.'),
      React.createElement('a', 
        { 
          href: '/',
          style: { color: '#667eea', textDecoration: 'none' }
        }, 
        '← Back to Dashboard'
      )
    )
  }
})

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  workflowsRoute,
  designerRoute,
  designerIdRoute,
  designerLegacyRoute,
  templatesRoute,
  credentialsRoute,
  executionsRoute,
  versionsRoute,
  mapperRoute,
  expressionEditorRoute,
  notFoundRoute
])

// Create and export the router
export const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}