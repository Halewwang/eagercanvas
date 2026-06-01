const BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '3:2': { w: 1152, h: 768 },
  '2:3': { w: 768, h: 1152 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '4:5': { w: 896, h: 1120 },
  '5:4': { w: 1120, h: 896 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '21:9': { w: 1680, h: 720 }
}

export const getImageConfigRatioFromSizeKey = (sizeKey) => {
  if (String(sizeKey || '').trim().toLowerCase() === 'auto') return 'auto'
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return '1:1'
}

export const getImageConfigResolutionFromSizeKey = (sizeKey) => {
  if (String(sizeKey || '').trim().toLowerCase() === 'auto') return '1k'
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1k'
  const ratio = getImageConfigRatioFromSizeKey(sizeKey)
  const base = BASE_SIZE_BY_RATIO[ratio] || BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

export const createImageConfigSizeMetaOptions = (sizeOptions = []) =>
  sizeOptions.map((option) => {
    const key = String(option?.key || '')
    const [w, h] = key.split('x').map(Number)
    return {
      key,
      ratio: getImageConfigRatioFromSizeKey(key),
      resolution: getImageConfigResolutionFromSizeKey(key),
      pixels: (w || 0) * (h || 0)
    }
  })

export const resolveImageConfigSizeSelection = ({
  sizeOptions = [],
  currentSize = '',
  ratio,
  resolution
} = {}) => {
  if (ratio === 'auto') {
    return {
      size: 'auto',
      ratio: 'auto',
      resolution
    }
  }

  const metaOptions = createImageConfigSizeMetaOptions(sizeOptions)
  let candidates = metaOptions.filter((option) => option.ratio === ratio && option.key !== 'auto')
  if (candidates.length === 0) {
    candidates = metaOptions.filter((option) => option.key !== 'auto')
  }

  if (candidates.length === 0) {
    return {
      size: currentSize || '1024x1024',
      ratio,
      resolution
    }
  }

  const exact = candidates.find((option) => option.resolution === resolution)
  const picked = exact || [...candidates].sort((a, b) => a.pixels - b.pixels)[0]
  return {
    size: picked.key,
    ratio: picked.ratio,
    resolution: picked.resolution
  }
}
