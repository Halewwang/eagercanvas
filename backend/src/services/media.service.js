import { createHash } from 'node:crypto'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const normalizeVideoAsset = ({ project, node }) => {
  const url = String(node?.data?.url || '').trim()
  if (!url || url.startsWith('blob:')) return null

  const name = String(
    node?.data?.label ||
    node?.data?.name ||
    project?.name ||
    'Generated Video'
  ).trim() || 'Generated Video'

  return {
    id: createHash('sha1').update(url).digest('hex'),
    name,
    url,
    thumbnailUrl: '',
    projectId: project.id,
    projectName: project.name,
    updatedAt: project.updated_at
  }
}

export const listGeneratedVideos = async (userId) => {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,updated_at,canvas_json')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new HttpError(500, error.message, 'MEDIA_LIST_FAILED')

  const seen = new Set()
  const items = []

  for (const project of data || []) {
    const nodes = Array.isArray(project?.canvas_json?.nodes)
      ? project.canvas_json.nodes
      : []

    for (const node of nodes) {
      if (node?.type !== 'video') continue

      const asset = normalizeVideoAsset({ project, node })
      if (!asset || seen.has(asset.url)) continue

      seen.add(asset.url)
      items.push(asset)
    }
  }

  return items
}
