import { loadImageElementFromSource } from './imageElementLoader.js'

const withExportTimeout = (promise, message) => {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), 30000)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const exportImageLocally = async ({
  source = '',
  maxEdge = 0,
  fileName = 'image.png',
  cropRect = null,
  cropSourceSize = null,
  loadImageElement = loadImageElementFromSource,
  createCanvas = () => document.createElement('canvas')
} = {}) => {
  if (typeof source !== 'string' || !source.trim()) throw new Error('No image source')
  if (![0, 1024, 2048, 4096].includes(maxEdge)) throw new Error('Invalid export size')

  let loadedImage
  let loadingFinished = false
  const loading = Promise.resolve(loadImageElement(source)).then((loaded) => {
    if (loadingFinished) loaded?.cleanup?.()
    return loaded
  })

  try {
    loadedImage = await withExportTimeout(loading, 'Image loading timed out')
    const naturalWidth = loadedImage?.img?.naturalWidth
    const naturalHeight = loadedImage?.img?.naturalHeight
    if (![naturalWidth, naturalHeight].every((value) => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('Invalid image dimensions')
    }

    const hasCropSourceSize = cropRect !== null && cropSourceSize !== null
    const coordinateWidth = hasCropSourceSize ? cropSourceSize.width : naturalWidth
    const coordinateHeight = hasCropSourceSize ? cropSourceSize.height : naturalHeight
    if (![coordinateWidth, coordinateHeight].every((value) => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('Invalid crop source dimensions')
    }
    let { x, y, width, height } = cropRect ?? { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
    if (![x, y, width, height].every(Number.isFinite)
      || x < 0 || y < 0 || width <= 0 || height <= 0
      || x + width > coordinateWidth || y + height > coordinateHeight) {
      throw new Error('Invalid crop rectangle')
    }
    x *= naturalWidth / coordinateWidth
    y *= naturalHeight / coordinateHeight
    width = Math.min(naturalWidth - x, width * naturalWidth / coordinateWidth)
    height = Math.min(naturalHeight - y, height * naturalHeight / coordinateHeight)
    if (width <= 0 || height <= 0) throw new Error('Invalid crop rectangle')

    const scale = maxEdge ? maxEdge / Math.max(width, height) : 1
    const outputWidth = Math.max(1, Math.round(width * scale))
    const outputHeight = Math.max(1, Math.round(height * scale))
    if (outputWidth > 16384 || outputHeight > 16384 || outputWidth * outputHeight > 67000000) {
      throw new Error('Export dimensions exceed image limits')
    }

    const canvas = createCanvas()
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image export canvas unavailable')
    context.drawImage(loadedImage.img, x, y, width, height, 0, 0, outputWidth, outputHeight)

    const blob = await withExportTimeout(
      new Promise((resolve) => canvas.toBlob(resolve, 'image/png')),
      'Image encoding timed out'
    )
    if (!blob || !Number.isFinite(blob.size) || blob.size <= 0) throw new Error('Image export is empty')

    return {
      blob,
      fileName: `${String(fileName || 'image.png').replace(/\.[^.]+$/, '')}.png`,
      width: outputWidth,
      height: outputHeight
    }
  } finally {
    loadingFinished = true
    loadedImage?.cleanup?.()
  }
}
