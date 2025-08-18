/**
 * Connection Analysis Module
 * Functions for analyzing, grouping, and managing connections between nodes
 */

/**
 * Basic connection interface for analysis
 */
export interface AnalyzableConnection {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourcePortId: string
  targetPortId: string
}

/**
 * Enhanced connection with group information
 */
export interface GroupedConnection extends AnalyzableConnection {
  index: number
  total: number
  groupKey: string
}

/**
 * Connection group information
 */
export interface ConnectionGroupInfo {
  index: number
  total: number
  isMultiple: boolean
  groupKey: string
}

/**
 * Connection group statistics
 */
export interface ConnectionGroupStats {
  totalGroups: number
  totalConnections: number
  multipleConnectionGroups: number
  largestGroupSize: number
  averageGroupSize: number
}

/**
 * Generates a unique key for a connection group based on node pairs AND port pairs
 */
export function generateConnectionGroupKey(
  sourceNodeId: string,
  targetNodeId: string,
  sourcePortId?: string,
  targetPortId?: string
): string {
  const srcPort = sourcePortId ?? '*'
  const tgtPort = targetPortId ?? '*'
  return `${sourceNodeId}:${srcPort}->${targetNodeId}:${tgtPort}`
}

/**
 * Groups connections by node pairs
 */
export function groupConnectionsByNodePairs(
  connections: AnalyzableConnection[]
): Map<string, AnalyzableConnection[]> {
  const groups = new Map<string, AnalyzableConnection[]>()

  for (const connection of connections) {
    const groupKey = generateConnectionGroupKey(
      connection.sourceNodeId,
      connection.targetNodeId,
      connection.sourcePortId,
      connection.targetPortId
    )

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }

    groups.get(groupKey)!.push(connection)
  }

  return groups
}

/**
 * Analyzes connections and creates groups with index information
 */
export function analyzeConnectionGroups(
  connections: AnalyzableConnection[]
): Map<string, GroupedConnection[]> {
  const rawGroups = groupConnectionsByNodePairs(connections)
  const analyzedGroups = new Map<string, GroupedConnection[]>()

  rawGroups.forEach((groupConnections, groupKey) => {
    const enrichedGroup = groupConnections.map((connection, index) => ({
      ...connection,
      index,
      total: groupConnections.length,
      groupKey
    }))

    analyzedGroups.set(groupKey, enrichedGroup)
  })

  return analyzedGroups
}

/**
 * Gets connection group information for a specific connection
 */
export function getConnectionGroupInfo(
  connectionId: string,
  connections: AnalyzableConnection[]
): ConnectionGroupInfo {
  // Find the connection
  const connection = connections.find(c => c.id === connectionId)
  if (!connection) {
    return {
      index: 0,
      total: 1,
      isMultiple: false,
      groupKey: 'unknown'
    }
  }

  // Generate group key
  const groupKey = generateConnectionGroupKey(
    connection.sourceNodeId,
    connection.targetNodeId,
    connection.sourcePortId,
    connection.targetPortId
  )

  // Find all connections in the same group
  const sameGroupConnections = connections.filter(c =>
    generateConnectionGroupKey(c.sourceNodeId, c.targetNodeId, c.sourcePortId, c.targetPortId) === groupKey
  )

  // Find index of current connection
  const index = sameGroupConnections.findIndex(c => c.id === connectionId)
  const total = sameGroupConnections.length

  return {
    index: index >= 0 ? index : 0,
    total,
    isMultiple: total > 1,
    groupKey
  }
}

/**
 * Finds all connections between two specific nodes
 */
export function findConnectionsBetweenNodes(
  sourceNodeId: string,
  targetNodeId: string,
  connections: AnalyzableConnection[]
): AnalyzableConnection[] {
  return connections.filter(c =>
    c.sourceNodeId === sourceNodeId && c.targetNodeId === targetNodeId
  )
}

/**
 * Finds all connections involving a specific node (as source or target)
 */
export function findConnectionsForNode(
  nodeId: string,
  connections: AnalyzableConnection[]
): {
  outgoing: AnalyzableConnection[]
  incoming: AnalyzableConnection[]
  all: AnalyzableConnection[]
} {
  const outgoing = connections.filter(c => c.sourceNodeId === nodeId)
  const incoming = connections.filter(c => c.targetNodeId === nodeId)

  return {
    outgoing,
    incoming,
    all: [...outgoing, ...incoming]
  }
}

/**
 * Gets statistics about connection groups
 */
export function getConnectionGroupStats(connections: AnalyzableConnection[]): ConnectionGroupStats {
  const groups = groupConnectionsByNodePairs(connections)
  const groupSizes = Array.from(groups.values()).map(group => group.length)

  const totalGroups = groups.size
  const totalConnections = connections.length
  const multipleConnectionGroups = groupSizes.filter(size => size > 1).length
  const largestGroupSize = Math.max(...groupSizes, 0)
  const averageGroupSize = totalConnections / totalGroups || 0

  return {
    totalGroups,
    totalConnections,
    multipleConnectionGroups,
    largestGroupSize,
    averageGroupSize
  }
}

/**
 * Finds groups with multiple connections
 */
export function findMultipleConnectionGroups(
  connections: AnalyzableConnection[]
): Map<string, GroupedConnection[]> {
  const allGroups = analyzeConnectionGroups(connections)
  const multipleGroups = new Map<string, GroupedConnection[]>()

  allGroups.forEach((groupConnections, groupKey) => {
    if (groupConnections.length > 1) {
      multipleGroups.set(groupKey, groupConnections)
    }
  })

  return multipleGroups
}

/**
 * Validates connection integrity (checks for duplicates, invalid references)
 */
export function validateConnectionIntegrity(
  connections: AnalyzableConnection[]
): {
  valid: boolean
  duplicateIds: string[]
  invalidConnections: string[]
  warnings: string[]
} {
  const duplicateIds: string[] = []
  const invalidConnections: string[] = []
  const warnings: string[] = []
  const seenIds = new Set<string>()

  for (const connection of connections) {
    // Check for duplicate IDs
    if (seenIds.has(connection.id)) {
      duplicateIds.push(connection.id)
    } else {
      seenIds.add(connection.id)
    }

    // Check for invalid data
    if (!connection.sourceNodeId || !connection.targetNodeId) {
      invalidConnections.push(connection.id)
    }

    if (!connection.sourcePortId || !connection.targetPortId) {
      warnings.push(`Connection ${connection.id} missing port IDs`)
    }

    // Check for self-connections
    if (connection.sourceNodeId === connection.targetNodeId) {
      warnings.push(`Connection ${connection.id} is a self-connection`)
    }
  }

  return {
    valid: duplicateIds.length === 0 && invalidConnections.length === 0,
    duplicateIds,
    invalidConnections,
    warnings
  }
}

/**
 * Optimizes connection order within groups for better visual layout
 */
export function optimizeConnectionOrder(
  groupedConnections: GroupedConnection[]
): GroupedConnection[] {
  // Sort by source port first, then target port for consistent ordering
  const ordered = [...groupedConnections].sort(
    (a: GroupedConnection, b: GroupedConnection) => {
      const sourcePortCompare = a.sourcePortId.localeCompare(b.sourcePortId)
      if (sourcePortCompare !== 0) {
        return sourcePortCompare
      }
      return a.targetPortId.localeCompare(b.targetPortId)
    }
  )
  return ordered.map((connection: GroupedConnection, index: number) => ({
    ...connection,
    index // Update index after sorting
  }))
}

/**
 * Creates a lookup map for fast connection group queries
 */
export function createConnectionGroupLookup(
  connections: AnalyzableConnection[]
): Map<string, ConnectionGroupInfo> {
  const lookup = new Map<string, ConnectionGroupInfo>()

  for (const connection of connections) {
    const groupInfo = getConnectionGroupInfo(connection.id, connections)
    lookup.set(connection.id, groupInfo)
  }

  return lookup
}

/**
 * Detects potential connection issues
 */
export function detectConnectionIssues(
  connections: AnalyzableConnection[]
): {
  unusuallyLargeGroups: string[]
  potentialDuplicates: string[]
  orphanedConnections: string[]
} {
  const groups = groupConnectionsByNodePairs(connections)
  const unusuallyLargeGroups: string[] = []
  const potentialDuplicates: string[] = []
  const orphanedConnections: string[] = []

  groups.forEach((groupConnections, groupKey) => {
    // Flag groups with many connections (might indicate a design issue)
    if (groupConnections.length > 5) {
      unusuallyLargeGroups.push(groupKey)
    }

    // Look for potential duplicates (same ports)
    const portCombos = new Set<string>()
    for (const conn of groupConnections) {
      const portCombo = `${conn.sourcePortId}->${conn.targetPortId}`
      if (portCombos.has(portCombo)) {
        potentialDuplicates.push(conn.id)
      } else {
        portCombos.add(portCombo)
      }
    }
  })

  return {
    unusuallyLargeGroups,
    potentialDuplicates,
    orphanedConnections
  }
}