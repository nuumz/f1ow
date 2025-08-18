import './DataMapper.css'

interface DataItem {
  key: string
  value: any
  type: string
  path: string
  children?: DataItem[]
  expanded?: boolean
}

interface MappingRule {
  id: string
  sourcePath: string
  targetPath: string
  transform?: string
  description?: string
}

interface DataMapperProps {
  sourceData: any
  targetSchema: any
  mappings: MappingRule[]
}

export default function DataMapper({ sourceData, targetSchema, mappings }: DataMapperProps) {
  // State for component functionality (available for future use)
  // const [expandedItems] = useState<Set<string>>(new Set())

  // Convert object to tree structure
  const objectToTree = (obj: any, prefix = ''): DataItem[] => {
    if (!obj || typeof obj !== 'object') {return []}
    
    return Object.entries(obj).map(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      const type = Array.isArray(value) ? 'array' : typeof value
      
      return {
        key,
        value,
        type,
        path,
        children: type === 'object' || type === 'array' ? objectToTree(value, path) : undefined
      }
    })
  }

  // Generate tree data
  const sourceTree = objectToTree(sourceData)
  const targetTree = objectToTree(targetSchema)

  return (
    <div className="data-mapper">
      <div className="mapper-header">
        <h2>Data Mapper</h2>
        <div className="mapper-stats">
          <span>{mappings.length} mappings</span>
        </div>
      </div>
      
      <div className="mapper-content">
        <div className="mapper-panel">
          <h3>Source Data</h3>
          <div className="data-tree">
            {sourceTree.map(item => (
              <div key={item.path} className="tree-item">
                {item.key}: {typeof item.value} 
              </div>
            ))}
          </div>
        </div>
        
        <div className="mapper-panel">
          <h3>Target Schema</h3>
          <div className="data-tree">
            {targetTree.map(item => (
              <div key={item.path} className="tree-item">
                {item.key}: {typeof item.value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
