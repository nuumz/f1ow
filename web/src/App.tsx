import React from 'react'
import { Routes, Route } from 'react-router-dom'
import WorkflowDesigner from './components/WorkflowDesigner'
import WorkflowList from './components/WorkflowList'
import ExecutionHistory from './components/ExecutionHistory'

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <h1>Workflow Engine</h1>
        <div className="nav-links">
          <a href="/">Workflows</a>
          <a href="/designer">Designer</a>
          <a href="/executions">Executions</a>
        </div>
      </nav>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<WorkflowList />} />
          <Route path="/designer" element={<WorkflowDesigner />} />
          <Route path="/designer/:id" element={<WorkflowDesigner />} />
          <Route path="/executions" element={<ExecutionHistory />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
