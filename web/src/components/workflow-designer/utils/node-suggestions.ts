// Utility for suggesting a default next node type based on context
// Keep logic simple and deterministic, expand later if needed

export type DesignerMode = 'workflow' | 'architecture'

export function suggestNextNodeType(
    sourceNodeType: string | undefined,
    designerMode: DesignerMode
): string {
    if (designerMode === 'architecture') {
        // Generic service node for architecture view
        return 'microservice'
    }

    // Workflow defaults
    if (!sourceNodeType) {return 'set'}

    // Common patterns
    if (sourceNodeType === 'start') {return 'http'}
    if (sourceNodeType === 'http') {return 'set'}

    // Fallback
    return 'set'
}
