import path from 'path'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const MEDIA_LIBRARY_ACTIONS = ['media.uploaded', 'media.generated']
const GENERATION_TYPES = new Set(['image', 'video'])
const DEFAULT_ASSET_LIMIT = 60
const DEFAULT_HISTORY_LIMIT = 40
const MAX_LIMIT = 100

const trimString = (value = '') => String(value || '').trim()
const normalizeProjectId = (value = '') => trimString(value)
const isInlineDataUrl = (value = '') => /^data:[^;,]+;base64,/i.test(trimString(value))
const normalizeLimit = (value, fallback) => {
  const numeric = Number(value || fallback)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(numeric)))
}

const isImageType = (value = '') => /^image\//i.test(trimString(value))
const isVideoType = (value = '') => /^video\//i.test(trimString(value))

const getExtensionFromUrl = (url = '') => {
  try {
    return trimString(path.extname(new URL(trimString(url)).pathname || '')).toLowerCase()
  } catch {
    return ''
  }
}

const inferAssetKind = ({ fileType = '', fileName = '', url = '', runType = '' } = {}) => {
  const normalizedRunType = trimString(runType).toLowerCase()
  if (normalizedRunType === 'video') return 'video'
  if (normalizedRunType === 'image') return 'image'

  const normalizedFileType = trimString(fileType).toLowerCase()
  if (isImageType(normalizedFileType)) return 'image'
  if (isVideoType(normalizedFileType)) return 'video'

  const extension = trimString(path.extname(fileName || '') || getExtensionFromUrl(url)).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) return 'image'
  if (['.mp4', '.webm', '.mov', '.m4v'].includes(extension)) return 'video'
  return 'file'
}

const buildAssetTitle = ({ fileName = '', kind = '', runType = '' } = {}) => {
  const safeFileName = trimString(fileName)
  if (safeFileName) return safeFileName
  const normalizedKind = trimString(kind).toLowerCase()
  if (normalizedKind === 'video') return 'Video Asset'
  if (normalizedKind === 'image') return 'Image Asset'
  return 'Asset'
}

const normalizeAssetRecord = ({
  id = '',
  createdAt = '',
  projectId = '',
  kind = '',
  url = '',
  previewUrl = '',
  fileName = '',
  fileType = '',
  sourceType = '',
  origin = '',
  runId = '',
  runType = '',
  model = '',
  sourceNodeId = ''
} = {}) => {
  const rawUrl = trimString(url)
  const rawPreviewUrl = trimString(previewUrl)
  const safeUrl = isInlineDataUrl(rawUrl)
    ? (isInlineDataUrl(rawPreviewUrl) ? '' : rawPreviewUrl)
    : rawUrl
  if (!safeUrl) return null

  const safeKind = trimString(kind) || inferAssetKind({ fileType, fileName, url: safeUrl, runType })
  const safePreviewUrl = rawPreviewUrl && !isInlineDataUrl(rawPreviewUrl) ? rawPreviewUrl : safeUrl

  return {
    id: trimString(id),
    createdAt: trimString(createdAt),
    projectId: normalizeProjectId(projectId),
    kind: safeKind,
    url: safeUrl,
    previewUrl: safePreviewUrl,
    fileName: buildAssetTitle({ fileName, kind: safeKind, runType }),
    fileType: trimString(fileType),
    sourceType: trimString(sourceType) || 'upload',
    origin: trimString(origin),
    runId: trimString(runId),
    runType: trimString(runType),
    model: trimString(model),
    sourceNodeId: trimString(sourceNodeId)
  }
}

const normalizeGeneratedAssets = (assets = [], fallback = {}) =>
  (Array.isArray(assets) ? assets : [])
    .map((asset, index) => normalizeAssetRecord({
      id: `${trimString(fallback.runId || 'run')}-${index}`,
      createdAt: fallback.createdAt,
      projectId: fallback.projectId,
      kind: asset?.kind,
      url: asset?.url,
      previewUrl: asset?.previewUrl,
      fileName: asset?.fileName,
      fileType: asset?.fileType,
      sourceType: 'generation',
      origin: asset?.origin || 'generation',
      runId: fallback.runId,
      runType: fallback.runType,
      model: fallback.model,
      sourceNodeId: asset?.sourceNodeId || fallback.sourceNodeId
    }))
    .filter(Boolean)

const fetchAuditEntries = async ({ userId, limit = 120 }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, metadata, created_at')
    .eq('user_id', userId)
    .in('action', MEDIA_LIBRARY_ACTIONS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new HttpError(500, error.message, 'MEDIA_LIBRARY_FETCH_FAILED')
  }

  return Array.isArray(data) ? data : []
}

export const recordUploadedMediaAsset = async ({
  userId,
  projectId = '',
  url = '',
  fileName = '',
  fileType = '',
  sizeBytes = 0,
  origin = 'upload',
  source = '',
  sourceNodeId = ''
} = {}) => {
  const assetUrl = trimString(url)
  if (!userId || !assetUrl) return null

  const metadata = {
    project_id: normalizeProjectId(projectId) || null,
    asset_url: assetUrl,
    preview_url: assetUrl,
    file_name: trimString(fileName),
    file_type: trimString(fileType),
    size_bytes: Number(sizeBytes || 0),
    asset_kind: inferAssetKind({ fileType, fileName, url: assetUrl }),
    origin: trimString(origin) || 'upload',
    source: trimString(source) || 'manual_upload',
    source_node_id: trimString(sourceNodeId) || null
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action: 'media.uploaded',
      metadata
    })
    .select('id, created_at')
    .single()

  if (error) {
    console.warn('[media-library] upload asset record failed', error.message)
    return null
  }

  return normalizeAssetRecord({
    id: data?.id,
    createdAt: data?.created_at,
    projectId: metadata.project_id,
    kind: metadata.asset_kind,
    url: metadata.asset_url,
    previewUrl: metadata.preview_url,
    fileName: metadata.file_name,
    fileType: metadata.file_type,
    sourceType: 'upload',
    origin: metadata.origin,
    sourceNodeId: metadata.source_node_id
  })
}

export const upsertGeneratedMediaRecord = async ({
  userId,
  runId = '',
  projectId = '',
  runType = '',
  model = '',
  prompt = '',
  status = 'completed',
  error = '',
  assets = [],
  sourceNodeId = ''
} = {}) => {
  const safeRunId = trimString(runId)
  const safeRunType = trimString(runType).toLowerCase()
  if (!userId || !safeRunId || !GENERATION_TYPES.has(safeRunType)) return null

  const normalizedAssets = normalizeGeneratedAssets(assets, {
    runId: safeRunId,
    runType: safeRunType,
    projectId: normalizeProjectId(projectId),
    model: trimString(model),
    sourceNodeId: trimString(sourceNodeId)
  })

  const metadata = {
    run_id: safeRunId,
    project_id: normalizeProjectId(projectId) || null,
    run_type: safeRunType,
    model: trimString(model),
    prompt: trimString(prompt),
    status: trimString(status) || 'completed',
    error: trimString(error),
    output_count: normalizedAssets.length,
    preview_url: normalizedAssets[0]?.previewUrl || normalizedAssets[0]?.url || '',
    source_node_id: trimString(sourceNodeId) || null,
    assets: normalizedAssets.map((asset) => ({
      kind: asset.kind,
      url: asset.url,
      previewUrl: asset.previewUrl,
      fileName: asset.fileName,
      fileType: asset.fileType,
      origin: asset.origin,
      sourceNodeId: asset.sourceNodeId
    }))
  }

  const { data: existing, error: findError } = await supabase
    .from('audit_logs')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('action', 'media.generated')
    .contains('metadata', { run_id: safeRunId })
    .limit(1)

  if (findError) {
    console.warn('[media-library] generation record lookup failed', findError.message)
    return null
  }

  const existingId = existing?.[0]?.id
  const existingMetadata = existing?.[0]?.metadata || {}
  const existingSourceNodeId = trimString(
    existingMetadata.source_node_id ||
    existingMetadata.assets?.[0]?.sourceNodeId ||
    ''
  )

  if (existingSourceNodeId && !trimString(sourceNodeId)) {
    metadata.source_node_id = existingSourceNodeId
    normalizedAssets.forEach((asset) => {
      if (!asset.sourceNodeId) {
        asset.sourceNodeId = existingSourceNodeId
      }
    })
    metadata.assets = normalizedAssets.map((asset) => ({
      kind: asset.kind,
      url: asset.url,
      previewUrl: asset.previewUrl,
      fileName: asset.fileName,
      fileType: asset.fileType,
      origin: asset.origin,
      sourceNodeId: asset.sourceNodeId || existingSourceNodeId
    }))
  }

  if (existingId) {
    const { error: updateError } = await supabase
      .from('audit_logs')
      .update({ metadata })
      .eq('id', existingId)

    if (updateError) {
      console.warn('[media-library] generation record update failed', updateError.message)
      return null
    }

    return {
      runId: safeRunId,
      projectId: metadata.project_id,
      runType: metadata.run_type,
      model: metadata.model,
      status: metadata.status,
      assets: normalizedAssets
    }
  }

  const { error: insertError } = await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action: 'media.generated',
      metadata
    })

  if (insertError) {
    console.warn('[media-library] generation record insert failed', insertError.message)
    return null
  }

  return {
    runId: safeRunId,
    projectId: metadata.project_id,
    runType: metadata.run_type,
    model: metadata.model,
    status: metadata.status,
    assets: normalizedAssets
  }
}

export const findGeneratedMediaRecordByRunId = async ({
  userId,
  runId = ''
} = {}) => {
  const safeRunId = trimString(runId)
  if (!userId || !safeRunId) return null

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, metadata, created_at')
    .eq('user_id', userId)
    .eq('action', 'media.generated')
    .contains('metadata', { run_id: safeRunId })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'MEDIA_GENERATION_RECORD_FETCH_FAILED')
  }

  const entry = Array.isArray(data) ? data[0] : null
  if (!entry) return null

  const metadata = entry?.metadata || {}
  const runType = trimString(metadata.run_type).toLowerCase()
  const projectId = normalizeProjectId(metadata.project_id)
  const model = trimString(metadata.model)
  const assets = normalizeGeneratedAssets(metadata.assets, {
    createdAt: entry.created_at,
    runId: safeRunId,
    projectId,
    runType,
    model,
    sourceNodeId: metadata.source_node_id
  })

  return {
    id: trimString(entry.id),
    runId: safeRunId,
    projectId,
    runType,
    model,
    status: trimString(metadata.status),
    error: trimString(metadata.error),
    previewUrl: trimString(metadata.preview_url || assets[0]?.previewUrl || assets[0]?.url || ''),
    outputCount: Number(metadata.output_count || assets.length || 0),
    assets
  }
}

export const listMediaAssets = async ({
  userId,
  projectId = '',
  limit = DEFAULT_ASSET_LIMIT
} = {}) => {
  const safeLimit = normalizeLimit(limit, DEFAULT_ASSET_LIMIT)
  const safeProjectId = normalizeProjectId(projectId)
  const logs = await fetchAuditEntries({ userId, limit: Math.min(safeLimit * 4, 280) })
  const items = []
  const seen = new Set()

  logs.forEach((entry) => {
    const metadata = entry?.metadata || {}
    const entryProjectId = normalizeProjectId(metadata.project_id)
    if (safeProjectId && entryProjectId !== safeProjectId) return

    if (entry.action === 'media.uploaded') {
      const asset = normalizeAssetRecord({
        id: `upload-${entry.id}`,
        createdAt: entry.created_at,
        projectId: entryProjectId,
        kind: metadata.asset_kind,
        url: metadata.asset_url,
        previewUrl: metadata.preview_url,
        fileName: metadata.file_name,
        fileType: metadata.file_type,
        sourceType: 'upload',
        origin: metadata.origin,
        sourceNodeId: metadata.source_node_id
      })
      if (!asset) return
      const key = `${asset.sourceType}:${asset.url}`
      if (seen.has(key)) return
      seen.add(key)
      items.push(asset)
      return
    }

    if (entry.action === 'media.generated') {
      const generatedAssets = normalizeGeneratedAssets(metadata.assets, {
        createdAt: entry.created_at,
        runId: metadata.run_id,
        projectId: entryProjectId,
        runType: metadata.run_type,
        model: metadata.model
      })
      generatedAssets.forEach((asset, index) => {
        const nextAsset = {
          ...asset,
          id: `generated-${entry.id}-${index}`
        }
        const key = `${nextAsset.sourceType}:${nextAsset.url}`
        if (seen.has(key)) return
        seen.add(key)
        items.push(nextAsset)
      })
    }
  })

  return {
    items: items
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, safeLimit)
  }
}

export const listGenerationHistory = async ({
  userId,
  projectId = '',
  limit = DEFAULT_HISTORY_LIMIT
} = {}) => {
  const safeLimit = normalizeLimit(limit, DEFAULT_HISTORY_LIMIT)
  const safeProjectId = normalizeProjectId(projectId)

  const [{ data: runs, error: runsError }, auditLogs] = await Promise.all([
    supabase
      .from('workflow_runs')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(Math.min(safeLimit * 3, 240)),
    fetchAuditEntries({ userId, limit: Math.min(safeLimit * 4, 280) })
  ])

  if (runsError) {
    throw new HttpError(500, runsError.message, 'GENERATION_HISTORY_FETCH_FAILED')
  }

  const generatedLogMap = new Map()
  auditLogs.forEach((entry) => {
    if (entry.action !== 'media.generated') return
    const runId = trimString(entry?.metadata?.run_id)
    if (!runId || generatedLogMap.has(runId)) return
    generatedLogMap.set(runId, entry)
  })

  const items = (Array.isArray(runs) ? runs : [])
    .filter((run) => GENERATION_TYPES.has(trimString(run?.type).toLowerCase()))
    .filter((run) => !safeProjectId || normalizeProjectId(run?.project_id) === safeProjectId)
    .map((run) => {
      const logEntry = generatedLogMap.get(trimString(run.id))
      const logMetadata = logEntry?.metadata || {}
      const assets = normalizeGeneratedAssets(logMetadata.assets, {
        createdAt: logEntry?.created_at || run?.started_at || run?.created_at,
        runId: run.id,
        projectId: run.project_id,
        runType: run.type,
        model: logMetadata.model
      })

      return {
        id: trimString(run.id),
        runId: trimString(run.id),
        type: trimString(run.type),
        projectId: normalizeProjectId(run.project_id),
        model: trimString(logMetadata.model),
        status: trimString(run.status),
        startedAt: trimString(run.started_at || run.created_at),
        finishedAt: trimString(run.finished_at),
        error: trimString(run.error_msg),
        previewUrl: trimString(logMetadata.preview_url || assets[0]?.previewUrl || assets[0]?.url || ''),
        outputCount: Number(logMetadata.output_count || assets.length || 0),
        assets
      }
    })

  return {
    items: items.slice(0, safeLimit)
  }
}
