/**
 * Schema definitions for workflow nodes and components
 * JSON Schema-like definitions for validation and UI generation
 */

import type { DataType, NodeCategory } from '../types'

// Base schema interface
export interface BaseSchema {
  type: string
  title?: string
  description?: string
  default?: any
  examples?: any[]
}

// Property schema for node configuration
export interface PropertySchema extends BaseSchema {
  enum?: string[]
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  items?: PropertySchema
  properties?: Record<string, PropertySchema>
  required?: string[]
  additionalProperties?: boolean
}

// Port schema definition
export interface PortSchema {
  name: string
  type: DataType
  description: string
  required: boolean
  multiple?: boolean
  defaultValue?: any
}

// Node configuration schema
export interface NodeConfigSchema {
  type: 'object'
  properties: Record<string, PropertySchema>
  required?: string[]
  additionalProperties?: boolean
  uiSchema?: UISchema
}

// Complete node schema
export interface NodeSchema {
  // Basic node information
  nodeType: string
  name: string
  description: string
  category: NodeCategory
  icon: string
  color?: string
  
  // Configuration schema
  config: NodeConfigSchema
  
  // Port definitions
  inputs: PortSchema[]
  outputs: PortSchema[]
  
  // Additional metadata
  version?: string
  author?: string
  tags?: string[]
  documentation?: string
  examples?: any[]
}

// UI Schema for rendering configuration forms
export interface UISchema {
  [property: string]: UISchemaElement
}

export interface UISchemaElement {
  'ui:widget'?: 
    | 'text' 
    | 'password' 
    | 'email' 
    | 'url' 
    | 'textarea' 
    | 'select' 
    | 'radio' 
    | 'checkbox' 
    | 'range' 
    | 'color' 
    | 'date' 
    | 'datetime' 
    | 'file' 
    | 'hidden'
    | 'code-editor'
    | 'json-editor'
    | 'key-value-editor'
  'ui:options'?: {
    placeholder?: string
    rows?: number
    cols?: number
    label?: boolean
    help?: string
    description?: string
    inline?: boolean
    disabled?: boolean
    readonly?: boolean
    autofocus?: boolean
  }
  'ui:order'?: string[]
  'ui:field'?: string
  'ui:title'?: string
  'ui:description'?: string
  'ui:help'?: string
  'ui:placeholder'?: string
  'ui:disabled'?: boolean
  'ui:readonly'?: boolean
  'ui:hidden'?: boolean
}

// Validation schema
export interface ValidationSchema {
  [property: string]: ValidationRule[]
}

export interface ValidationRule {
  type: 'required' | 'pattern' | 'min' | 'max' | 'length' | 'custom'
  value?: any
  message: string
  validator?: (value: any, allValues: any) => boolean | string
}

// Schema registry for node types
export interface SchemaRegistry {
  [nodeType: string]: NodeSchema
}

// Common property schemas for reuse
export const CommonSchemas = {
  // Basic types
  string: {
    type: 'string',
    title: 'Text',
    description: 'Text input'
  } as PropertySchema,

  number: {
    type: 'number',
    title: 'Number',
    description: 'Numeric input'
  } as PropertySchema,

  boolean: {
    type: 'boolean',
    title: 'Boolean',
    description: 'True/False value'
  } as PropertySchema,

  // URL schema
  url: {
    type: 'string',
    format: 'uri',
    title: 'URL',
    description: 'Valid URL',
    pattern: '^https?://.+'
  } as PropertySchema,

  // Email schema
  email: {
    type: 'string',
    format: 'email',
    title: 'Email',
    description: 'Valid email address'
  } as PropertySchema,

  // Code schema
  code: {
    type: 'string',
    title: 'Code',
    description: 'Code or script content'
  } as PropertySchema,

  // JSON schema
  json: {
    type: 'object',
    title: 'JSON Object',
    description: 'JSON object or configuration'
  } as PropertySchema,

  // Array schema
  array: {
    type: 'array',
    title: 'Array',
    description: 'Array of values'
  } as PropertySchema,

  // HTTP method schema
  httpMethod: {
    type: 'string',
    title: 'HTTP Method',
    description: 'HTTP request method',
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    default: 'GET'
  } as PropertySchema,

  // Timeout schema
  timeout: {
    type: 'number',
    title: 'Timeout (seconds)',
    description: 'Request timeout in seconds',
    minimum: 1,
    maximum: 300,
    default: 30
  } as PropertySchema,

  // Headers schema
  headers: {
    type: 'object',
    title: 'Headers',
    description: 'HTTP headers as key-value pairs',
    additionalProperties: true,
    properties: {}
  } as PropertySchema,

  // Query parameters schema
  queryParams: {
    type: 'object',
    title: 'Query Parameters',
    description: 'URL query parameters as key-value pairs',
    additionalProperties: true,
    properties: {}
  } as PropertySchema,

  // Authentication schemas
  authType: {
    type: 'string',
    title: 'Authentication Type',
    description: 'Type of authentication to use',
    enum: ['none', 'basic', 'bearer', 'api_key', 'oauth2'],
    default: 'none'
  } as PropertySchema,

  // Database connection schemas
  databaseUrl: {
    type: 'string',
    title: 'Database URL',
    description: 'Database connection string',
    format: 'uri'
  } as PropertySchema,

  // File path schema
  filePath: {
    type: 'string',
    title: 'File Path',
    description: 'Path to file or directory'
  } as PropertySchema,

  // Condition schemas for control flow
  condition: {
    type: 'string',
    title: 'Condition',
    description: 'JavaScript expression that evaluates to boolean'
  } as PropertySchema,

  // Loop schemas
  arrayPath: {
    type: 'string',
    title: 'Array Path',
    description: 'Path to array in input data (e.g., "data.items")'
  } as PropertySchema,

  // Transform schemas
  transformCode: {
    type: 'string',
    title: 'Transform Code',
    description: 'JavaScript code to transform data'
  } as PropertySchema
}

// UI Schema templates
export const CommonUISchemas = {
  code: {
    'ui:widget': 'code-editor',
    'ui:options': {
      language: 'javascript',
      theme: 'vs-dark'
    }
  } as UISchemaElement,

  json: {
    'ui:widget': 'json-editor'
  } as UISchemaElement,

  password: {
    'ui:widget': 'password'
  } as UISchemaElement,

  textarea: {
    'ui:widget': 'textarea',
    'ui:options': {
      rows: 4
    }
  } as UISchemaElement,

  keyValue: {
    'ui:widget': 'key-value-editor'
  } as UISchemaElement,

  url: {
    'ui:widget': 'url',
    'ui:placeholder': 'https://example.com/api'
  } as UISchemaElement,

  email: {
    'ui:widget': 'email',
    'ui:placeholder': 'user@example.com'
  } as UISchemaElement
}

// Validation helper functions
export function validateSchema(schema: PropertySchema, value: any): ValidationResult {
  const errors: string[] = []

  // Type validation
  if (schema.type && typeof value !== schema.type && value !== undefined) {
    errors.push(`Expected ${schema.type}, got ${typeof value}`)
  }

  // Required validation
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push('This field is required')
  }

  // String validations
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`Minimum length is ${schema.minLength}`)
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push(`Maximum length is ${schema.maxLength}`)
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push('Invalid format')
    }
  }

  // Number validations
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`Minimum value is ${schema.minimum}`)
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`Maximum value is ${schema.maximum}`)
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`Must be one of: ${schema.enum.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

// Schema builder helpers
export class SchemaBuilder {
  private schema: Partial<NodeSchema> = {}

  static create(nodeType: string): SchemaBuilder {
    return new SchemaBuilder().setNodeType(nodeType)
  }

  setNodeType(nodeType: string): this {
    this.schema.nodeType = nodeType
    return this
  }

  setName(name: string): this {
    this.schema.name = name
    return this
  }

  setDescription(description: string): this {
    this.schema.description = description
    return this
  }

  setCategory(category: NodeCategory): this {
    this.schema.category = category
    return this
  }

  setIcon(icon: string): this {
    this.schema.icon = icon
    return this
  }

  setColor(color: string): this {
    this.schema.color = color
    return this
  }

  addInput(name: string, type: DataType, description: string, required = false): this {
    if (!this.schema.inputs) this.schema.inputs = []
    this.schema.inputs.push({ name, type, description, required })
    return this
  }

  addOutput(name: string, type: DataType, description: string, required = true): this {
    if (!this.schema.outputs) this.schema.outputs = []
    this.schema.outputs.push({ name, type, description, required })
    return this
  }

  addProperty(name: string, schema: PropertySchema): this {
    if (!this.schema.config) {
      this.schema.config = { type: 'object', properties: {} }
    }
    this.schema.config.properties![name] = schema
    return this
  }

  setRequired(fields: string[]): this {
    if (!this.schema.config) {
      this.schema.config = { type: 'object', properties: {} }
    }
    this.schema.config.required = fields
    return this
  }

  build(): NodeSchema {
    if (!this.schema.nodeType || !this.schema.name || !this.schema.description) {
      throw new Error('NodeType, name, and description are required')
    }
    
    return this.schema as NodeSchema
  }
}
