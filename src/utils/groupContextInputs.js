const getNodePositionValue = (node = {}, axis = 'x') => {
  const position = node.position || node.positionAbsolute || node.computedPosition || {}
  const value = Number(position?.[axis])
  return Number.isFinite(value) ? value : 0
}

const sortGroupNodesByCanvasPosition = (items = []) => [...items].sort((a, b) => {
  const yDiff = getNodePositionValue(a.node, 'y') - getNodePositionValue(b.node, 'y')
  if (yDiff) return yDiff
  const xDiff = getNodePositionValue(a.node, 'x') - getNodePositionValue(b.node, 'x')
  if (xDiff) return xDiff
  return a.index - b.index
})

const getImageValue = (node = {}) =>
  String(node.data?.previewUrl || node.data?.base64 || node.data?.url || '').trim()

export const resolveGroupOutputContexts = ({
  targetNodeId = '',
  nodes = [],
  groups = []
} = {}) => {
  const nodeById = new Map((Array.isArray(nodes) ? nodes : []).map((node) => [node.id, node]))
  const prompts = []
  const references = []
  const groupContexts = []

  ;(Array.isArray(groups) ? groups : []).forEach((group) => {
    const outputLinks = Array.isArray(group?.outputLinks) ? group.outputLinks : []
    const matchingLinks = outputLinks.filter((link) =>
      link?.targetNodeId === targetNodeId &&
      (!link.kind || link.kind === 'image-output')
    )
    if (!matchingLinks.length) return

    const orderedMembers = sortGroupNodesByCanvasPosition(
      (Array.isArray(group.nodeIds) ? group.nodeIds : [])
        .map((nodeId, index) => ({ node: nodeById.get(nodeId), index }))
        .filter((item) => item.node)
    )

    matchingLinks.forEach((link) => {
      const contextPrompts = []
      const contextReferences = []

      orderedMembers.forEach(({ node, index }) => {
        if (node.type === 'text') {
          const content = String(node.data?.content || '').trim()
          if (!content) return
          contextPrompts.push({
            linkId: link.id,
            groupId: group.id,
            groupName: group.name || '',
            nodeId: node.id,
            value: content,
            content,
            order: prompts.length + contextPrompts.length + 1,
            index,
            source: 'group'
          })
          return
        }

        if (node.type !== 'image') return
        const imageValue = getImageValue(node)
        if (!imageValue) return
        contextReferences.push({
          linkId: link.id,
          groupId: group.id,
          groupName: group.name || '',
          nodeId: node.id,
          value: imageValue,
          imageData: imageValue,
          order: references.length + contextReferences.length + 1,
          index,
          source: 'group'
        })
      })

      prompts.push(...contextPrompts)
      references.push(...contextReferences)
      groupContexts.push({
        linkId: link.id,
        groupId: group.id,
        groupName: group.name || '',
        targetNodeId,
        promptCount: contextPrompts.length,
        referenceCount: contextReferences.length,
        promptNodeIds: contextPrompts.map((entry) => entry.nodeId),
        referenceNodeIds: contextReferences.map((entry) => entry.nodeId)
      })
    })
  })

  return {
    prompts,
    references,
    groupContexts
  }
}
