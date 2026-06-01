import { loadImageElementFromSource } from './imageElementLoader.js'
import {
  getImageNodeCropSourceRect,
  getImageNodeRatioLabel,
  getImageNodeResolutionFromSizeKey
} from './imageNodeLayout.js'

const createDefaultCanvas = () => document.createElement('canvas')

const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(blob)
})

export const createImageNodeCropPayload = async ({
  source = '',
  cropRect = {},
  cropStageMetrics = {},
  createCanvas = createDefaultCanvas,
  loadImageElement = loadImageElementFromSource,
  now = Date.now,
  readBlobAsDataUrl: readDataUrl = readBlobAsDataUrl
} = {}) => {
  const loadedImage = await loadImageElement(source)

  try {
    const cropSourceRect = getImageNodeCropSourceRect({
      cropRect,
      metrics: cropStageMetrics,
      naturalSize: {
        width: loadedImage.img.naturalWidth,
        height: loadedImage.img.naturalHeight
      }
    })
    const cropWidth = cropSourceRect.width
    const cropHeight = cropSourceRect.height

    const canvas = createCanvas()
    canvas.width = cropWidth
    canvas.height = cropHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Crop canvas unavailable')

    context.drawImage(
      loadedImage.img,
      cropSourceRect.x,
      cropSourceRect.y,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    )

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Crop output failed')

    const inlineResult = String(await readDataUrl(blob) || '')
    return {
      url: inlineResult,
      base64: inlineResult,
      size: `${cropWidth}x${cropHeight}`,
      ratio: getImageNodeRatioLabel(cropWidth, cropHeight),
      resolution: getImageNodeResolutionFromSizeKey(`${cropWidth}x${cropHeight}`),
      fileType: 'image/png',
      fileName: `crop-${now()}.png`
    }
  } finally {
    loadedImage?.cleanup?.()
  }
}
