export const ratioFromMultiAngleSize = (sizeKey = '') => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return '1:1'
}

export const resolutionFromMultiAngleSize = (sizeKey = '') => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  const longest = Math.max(w || 0, h || 0)
  if (longest >= 3000) return '4k'
  if (longest >= 1700) return '2k'
  return '1k'
}

export const normalizeMultiAngleOptionList = (list = []) => list.map((item) => {
  if (typeof item === 'string') {
    return { key: item, label: item }
  }
  return {
    key: item?.key ?? item?.value ?? item?.label,
    label: item?.label ?? item?.key ?? item?.value
  }
}).filter((item) => item.key)

export const getMultiAngleFilteredSizeOptions = (sizeOptions = [], selectedRatio = '') => {
  const normalized = normalizeMultiAngleOptionList(sizeOptions)
  const matched = normalized.filter((item) => ratioFromMultiAngleSize(item.key) === selectedRatio)
  return matched.length ? matched : normalized
}

export const getMultiAngleResolutionOptions = (sizeOptions = [], selectedRatio = '') => {
  const seen = new Set()
  return getMultiAngleFilteredSizeOptions(sizeOptions, selectedRatio)
    .map((item) => {
      const resolution = resolutionFromMultiAngleSize(item.key)
      return {
        key: resolution,
        label: resolution.toUpperCase(),
        sizeKey: item.key
      }
    })
    .filter((item) => {
      if (!item.key || seen.has(item.key)) return false
      seen.add(item.key)
      return true
    })
}
