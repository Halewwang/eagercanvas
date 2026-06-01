const RESULT_FILE_TYPE = 'video/mp4'

const parseVideoEnhanceRatio = (ratioValue = '16:9') => {
  const [width, height] = String(ratioValue || '16:9').split(':').map(Number)
  if (!width || !height) return { width: 16, height: 9 }
  return { width, height }
}

export const resolveVideoEnhanceResolutionSize = (ratioValue, resolutionValue) => {
  const longEdgeMap = {
    '1080p': 1920,
    '2k': 2560,
    '4k': 3840
  }

  const { width, height } = parseVideoEnhanceRatio(ratioValue)
  const longEdge = longEdgeMap[String(resolutionValue || '4k').trim().toLowerCase()] || 3840
  const ratio = width / height

  if (ratio >= 1) {
    return {
      width: longEdge,
      height: Math.max(2, Math.round(longEdge / ratio / 2) * 2)
    }
  }

  return {
    width: Math.max(2, Math.round(longEdge * ratio / 2) * 2),
    height: longEdge
  }
}

export const createVideoEnhanceOutput = ({
  dynamicCompressionLevel = 'High',
  frameRate = '30',
  ratio = '16:9',
  resolution = '4k',
  videoEncoder = 'H265'
} = {}) => {
  const targetSize = resolveVideoEnhanceResolutionSize(ratio, resolution)
  const numericFrameRate = Number(frameRate)

  return {
    frameRate: Number.isFinite(numericFrameRate) && numericFrameRate > 0 ? numericFrameRate : 30,
    audioTransfer: 'Copy',
    audioCodec: 'AAC',
    videoEncoder,
    videoProfile: 'Main',
    dynamicCompressionLevel,
    resolution: targetSize
  }
}

export const createVideoEnhanceMeta = ({
  dynamicCompressionLevel = 'High',
  frameRate = '30',
  model = 'prob-4',
  resolution = '4k',
  videoEncoder = 'H265'
} = {}) => ({
  tool: 'video-enhance',
  model,
  resolution,
  frameRate,
  videoEncoder,
  dynamicCompressionLevel
})

export const createVideoEnhancePendingPayload = (controls = {}) => ({
  targetMode: 'new',
  fileType: RESULT_FILE_TYPE,
  meta: createVideoEnhanceMeta(controls)
})

export const createVideoEnhanceApplyPayload = ({
  url = '',
  ...controls
} = {}) => ({
  targetMode: 'new',
  url: String(url || '').trim(),
  fileType: RESULT_FILE_TYPE,
  meta: createVideoEnhanceMeta(controls)
})

export const createVideoEnhanceRequestPayload = ({
  dynamicCompressionLevel,
  file = '',
  frameRate,
  model = 'prob-4',
  ratio,
  resolution,
  videoEncoder
} = {}) => ({
  tool: 'enhance',
  file,
  model,
  filters: [{ model }],
  output: createVideoEnhanceOutput({
    dynamicCompressionLevel,
    frameRate,
    ratio,
    resolution,
    videoEncoder
  })
})

export const runVideoEnhancement = async ({
  videoGen,
  ...options
} = {}) => {
  if (typeof videoGen?.generate !== 'function') {
    throw new Error('Video generator is missing')
  }

  const result = await videoGen.generate(createVideoEnhanceRequestPayload(options))
  const nextUrl = String(result?.url || result?.video_url || '').trim()
  if (!nextUrl) {
    throw new Error('No video output from provider')
  }

  return nextUrl
}
