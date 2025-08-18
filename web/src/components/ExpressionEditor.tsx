import React, { useState, useRef } from 'react'
import { Code, Book, Lightbulb, Check, X, ChevronDown } from 'lucide-react'

interface ExpressionSuggestion {
  label: string
  detail: string
  insertText: string
  kind: 'function' | 'variable' | 'property' | 'constant'
  documentation?: string
}

interface ExpressionEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
  dataContext?: Record<string, any>
  onTest?: (expression: string) => Promise<any>
}

const builtInSuggestions: ExpressionSuggestion[] = [
  // String functions
  {
    label: 'toUpperCase()',
    detail: 'Converts string to uppercase',
    insertText: 'toUpperCase()',
    kind: 'function',
    documentation: 'Returns a new string with all characters converted to uppercase.'
  },
  {
    label: 'toLowerCase()',
    detail: 'Converts string to lowercase',
    insertText: 'toLowerCase()',
    kind: 'function',
    documentation: 'Returns a new string with all characters converted to lowercase.'
  },
  {
    label: 'substring(start, end)',
    detail: 'Extracts characters from a string',
    insertText: 'substring(${1:start}, ${2:end})',
    kind: 'function',
    documentation: 'Returns a substring from start index to end index.'
  },
  {
    label: 'replace(search, replace)',
    detail: 'Replaces text in a string',
    insertText: 'replace("${1:search}", "${2:replace}")',
    kind: 'function',
    documentation: 'Returns a new string with some or all matches of a pattern replaced.'
  },
  {
    label: 'split(separator)',
    detail: 'Splits a string into an array',
    insertText: 'split("${1:separator}")',
    kind: 'function',
    documentation: 'Splits a string into an array of substrings.'
  },
  // Array functions
  {
    label: 'length',
    detail: 'Gets the length of array or string',
    insertText: 'length',
    kind: 'property',
    documentation: 'Returns the number of elements in an array or characters in a string.'
  },
  {
    label: 'map(callback)',
    detail: 'Creates a new array with results of calling a function',
    insertText: 'map(item => ${1:item})',
    kind: 'function',
    documentation: 'Creates a new array populated with the results of calling a provided function on every element.'
  },
  {
    label: 'filter(callback)',
    detail: 'Creates a new array with filtered elements',
    insertText: 'filter(item => ${1:condition})',
    kind: 'function',
    documentation: 'Creates a new array with all elements that pass the test implemented by the provided function.'
  },
  {
    label: 'find(callback)',
    detail: 'Returns the first element that matches',
    insertText: 'find(item => ${1:condition})',
    kind: 'function',
    documentation: 'Returns the first element in the array that satisfies the provided testing function.'
  },
  {
    label: 'join(separator)',
    detail: 'Joins array elements into a string',
    insertText: 'join("${1:separator}")',
    kind: 'function',
    documentation: 'Creates a string from an array by concatenating all elements.'
  },
  // Math functions
  {
    label: 'Math.round()',
    detail: 'Rounds to the nearest integer',
    insertText: 'Math.round(${1:number})',
    kind: 'function',
    documentation: 'Returns the value of a number rounded to the nearest integer.'
  },
  {
    label: 'Math.floor()',
    detail: 'Rounds down to the nearest integer',
    insertText: 'Math.floor(${1:number})',
    kind: 'function',
    documentation: 'Returns the largest integer less than or equal to a given number.'
  },
  {
    label: 'Math.ceil()',
    detail: 'Rounds up to the nearest integer',
    insertText: 'Math.ceil(${1:number})',
    kind: 'function',
    documentation: 'Returns the smallest integer greater than or equal to a given number.'
  },
  {
    label: 'Math.abs()',
    detail: 'Returns absolute value',
    insertText: 'Math.abs(${1:number})',
    kind: 'function',
    documentation: 'Returns the absolute value of a number.'
  },
  // Date functions
  {
    label: 'new Date()',
    detail: 'Creates a new date object',
    insertText: 'new Date(${1})',
    kind: 'function',
    documentation: 'Creates a JavaScript Date instance.'
  },
  {
    label: 'toISOString()',
    detail: 'Converts date to ISO string',
    insertText: 'toISOString()',
    kind: 'function',
    documentation: 'Returns a string in simplified extended ISO format.'
  },
  // Variables
  {
    label: 'value',
    detail: 'Current input value',
    insertText: 'value',
    kind: 'variable',
    documentation: 'The current value being processed in the transformation.'
  },
  {
    label: 'data',
    detail: 'Full input data object',
    insertText: 'data',
    kind: 'variable',
    documentation: 'The complete input data object passed to the node.'
  },
  {
    label: 'index',
    detail: 'Current array index (when processing arrays)',
    insertText: 'index',
    kind: 'variable',
    documentation: 'The current index when processing arrays in map/filter operations.'
  }
]

export default function ExpressionEditor({ 
  value, 
  onChange, 
  placeholder = 'Enter JavaScript expression...', 
  height = 120,
  dataContext,
  onTest 
}: ExpressionEditorProps) {
  const [suggestions, setSuggestions] = useState<ExpressionSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [testResult, setTestResult] = useState<{ success: boolean; result?: any; error?: string } | null>(null)
  const [isTestingExpression, setIsTestingExpression] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Generate suggestions based on data context
  const getContextSuggestions = (context: Record<string, any>): ExpressionSuggestion[] => {
    const suggestions: ExpressionSuggestion[] = []
    
    const addObjectProperties = (obj: any, prefix = '') => {
      if (typeof obj !== 'object' || obj === null) {return}
      
      Object.keys(obj).forEach(key => {
        const fullPath = prefix ? `${prefix}.${key}` : key
        const value = obj[key]
        const type = Array.isArray(value) ? 'array' : typeof value
        
        suggestions.push({
          label: fullPath,
          detail: `${type} property`,
          insertText: fullPath,
          kind: 'property',
          documentation: `Property of type ${type} with value: ${JSON.stringify(value).substring(0, 100)}`
        })
        
        // Add nested properties (limit depth to avoid infinite recursion)
        if (typeof value === 'object' && value !== null && prefix.split('.').length < 3) {
          addObjectProperties(value, fullPath)
        }
      })
    }
    
    if (context) {
      addObjectProperties(context)
    }
    
    return suggestions
  }

  // Update suggestions based on input
  const updateSuggestions = (inputValue: string, position: number) => {
    const beforeCursor = inputValue.substring(0, position)
    const lastWord = beforeCursor.split(/[\s\(\)\[\],;]/).pop() || ''
    
    if (lastWord.length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    
    const contextSuggestions = dataContext ? getContextSuggestions(dataContext) : []
    const allSuggestions = [...builtInSuggestions, ...contextSuggestions]
    
    const filtered = allSuggestions.filter(suggestion =>
      suggestion.label.toLowerCase().includes(lastWord.toLowerCase())
    )
    
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setSelectedSuggestion(0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const position = e.target.selectionStart
    
    onChange(newValue)
    setCursorPosition(position)
    updateSuggestions(newValue, position)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) {return}
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestion(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        insertSuggestion(suggestions[selectedSuggestion])
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  const insertSuggestion = (suggestion: ExpressionSuggestion) => {
    const textarea = textareaRef.current
    if (!textarea) {return}
    
    const beforeCursor = value.substring(0, cursorPosition)
    const afterCursor = value.substring(cursorPosition)
    const lastWordStart = beforeCursor.split(/[\s\(\)\[\],;]/).pop()?.length || 0
    
    const newValue = 
      beforeCursor.substring(0, beforeCursor.length - lastWordStart) +
      suggestion.insertText +
      afterCursor
    
    onChange(newValue)
    setShowSuggestions(false)
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = beforeCursor.length - lastWordStart + suggestion.insertText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const testExpression = async () => {
    if (!onTest || !value.trim()) {return}
    
    setIsTestingExpression(true)
    try {
      const result = await onTest(value)
      setTestResult({ success: true, result })
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    } finally {
      setIsTestingExpression(false)
    }
  }

  const getSuggestionIcon = (kind: ExpressionSuggestion['kind']) => {
    switch (kind) {
      case 'function': return '🔧'
      case 'variable': return '📦'
      case 'property': return '🏷️'
      case 'constant': return '🔢'
      default: return '❓'
    }
  }

  return (
    <div className="expression-editor">
      <div className="editor-header">
        <div className="editor-title">
          <Code size={16} />
          <span>Expression Editor</span>
        </div>
        <div className="editor-actions">
          {onTest && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={testExpression}
              disabled={!value.trim() || isTestingExpression}
            >
              {isTestingExpression ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>
      </div>
      
      <div className="editor-container">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => updateSuggestions(value, cursorPosition)}
          placeholder={placeholder}
          style={{ height }}
          className="expression-input"
          spellCheck={false}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-popup" ref={suggestionsRef}>
            <div className="suggestions-header">
              <Lightbulb size={14} />
              <span>Suggestions</span>
            </div>
            <div className="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.label}-${index}`}
                  className={`suggestion-item ${index === selectedSuggestion ? 'selected' : ''}`}
                  onClick={() => insertSuggestion(suggestion)}
                >
                  <div className="suggestion-icon">
                    {getSuggestionIcon(suggestion.kind)}
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-label">{suggestion.label}</div>
                    <div className="suggestion-detail">{suggestion.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="suggestions-footer">
              <span>↑↓ Navigate • Enter/Tab Select • Esc Close</span>
            </div>
          </div>
        )}
      </div>
      
      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          <div className="result-header">
            {testResult.success ? <Check size={16} /> : <X size={16} />}
            <span>{testResult.success ? 'Test Result' : 'Test Error'}</span>
            <button
              className="close-result"
              onClick={() => setTestResult(null)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="result-content">
            {testResult.success ? (
              <pre>{JSON.stringify(testResult.result, null, 2)}</pre>
            ) : (
              <div className="error-message">{testResult.error}</div>
            )}
          </div>
        </div>
      )}
      
      <div className="editor-help">
        <div className="help-section">
          <Book size={14} />
          <div className="help-content">
            <h4>Quick Help</h4>
            <ul>
              <li><code>value</code> - Current input value</li>
              <li><code>data</code> - Full input data object</li>
              <li><code>value.toUpperCase()</code> - String methods</li>
              <li><code>data.items.length</code> - Object properties</li>
              <li><code>Math.round(value)</code> - Math functions</li>
            </ul>
          </div>
        </div>
        
        {dataContext && Object.keys(dataContext).length > 0 && (
          <div className="help-section">
            <ChevronDown size={14} />
            <div className="help-content">
              <h4>Available Data</h4>
              <div className="data-preview">
                <pre>{JSON.stringify(dataContext, null, 2).substring(0, 200)}...</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}