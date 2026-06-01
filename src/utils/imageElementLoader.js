export const loadImageElementFromSource = async (
  source,
  {
    createObjectURL = (value) => URL.createObjectURL(value),
    fetchImage = (value) => fetch(value),
    imageCtor = Image,
    revokeObjectURL = (value) => URL.revokeObjectURL(value)
  } = {}
) => {
  const resolvedSource = String(source || '').trim()
  if (!resolvedSource) throw new Error('No image source')

  const img = new imageCtor()
  img.decoding = 'async'
  let objectUrl = ''
  let nextSource = resolvedSource

  if (!resolvedSource.startsWith('data:image/')) {
    try {
      const response = await fetchImage(resolvedSource)
      const blob = await response.blob()
      objectUrl = createObjectURL(blob)
      nextSource = objectUrl
    } catch {
      img.crossOrigin = 'anonymous'
    }
  }

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = nextSource
  })

  return {
    img,
    cleanup: () => {
      if (objectUrl) revokeObjectURL(objectUrl)
    }
  }
}
