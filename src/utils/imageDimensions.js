const IMAGE_DIMENSION_RATIO_MATCHES = [
  ['1:1', 1],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['4:5', 4 / 5],
  ['5:4', 5 / 4],
  ['21:9', 21 / 9]
]

export const getImageRatioFromDimensions = (width, height) => {
  const safeWidth = Number(width) || 0
  const safeHeight = Number(height) || 0
  if (!safeWidth || !safeHeight) return '1:1'

  const ratio = safeWidth / safeHeight
  const match = IMAGE_DIMENSION_RATIO_MATCHES.find(([, value]) => Math.abs(ratio - value) < 0.05)
  return match ? match[0] : `${safeWidth}:${safeHeight}`
}

export const getImageDimensionsFromFile = (
  file,
  {
    createObjectURL = (value) => URL.createObjectURL(value),
    imageCtor = Image,
    revokeObjectURL = (value) => URL.revokeObjectURL(value)
  } = {}
) => new Promise((resolve) => {
  const objectUrl = createObjectURL(file)
  const img = new imageCtor()

  img.onload = () => {
    resolve({ width: img.width || 0, height: img.height || 0 })
    revokeObjectURL(objectUrl)
  }
  img.onerror = () => {
    resolve({ width: 0, height: 0 })
    revokeObjectURL(objectUrl)
  }
  img.src = objectUrl
})
