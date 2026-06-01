export const ratioFromSizeKey = (sizeKey = '') => {
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

export const resolutionFromSizeKey = (sizeKey = '') => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  const longest = Math.max(w || 0, h || 0)
  if (longest >= 3000) return '4k'
  if (longest >= 1700) return '2k'
  return '1k'
}

export const getWedding3x3RatioOptions = (sizeOptions = []) => {
  const seen = new Set()
  return (sizeOptions || [])
    .map((item) => ratioFromSizeKey(item?.key))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .map((item) => ({
      key: item,
      label: item
    }))
}

export const getWedding3x3ResolutionOptions = (sizeOptions = [], selectedRatio = '') => {
  const seen = new Set()
  return (sizeOptions || [])
    .filter((item) => ratioFromSizeKey(item?.key) === selectedRatio)
    .map((item) => resolutionFromSizeKey(item?.key))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .map((item) => ({
      key: item,
      label: item.toUpperCase()
    }))
}

export const resolveWedding3x3SelectedSize = (
  sizeOptions = [],
  selectedRatio = '',
  selectedResolution = '',
  fallbackSize = ''
) => {
  const exact = (sizeOptions || []).find(
    (item) => ratioFromSizeKey(item?.key) === selectedRatio && resolutionFromSizeKey(item?.key) === selectedResolution
  )
  if (exact?.key) return exact.key

  const sameRatio = (sizeOptions || []).find((item) => ratioFromSizeKey(item?.key) === selectedRatio)
  if (sameRatio?.key) return sameRatio.key

  return sizeOptions?.[0]?.key || fallbackSize || '1024x1024'
}
