const getDefaultWindow = () => (typeof window === 'undefined' ? undefined : window)

export const copyWedding3x3PreviewText = async (
  value,
  successMessage,
  {
    clipboard = getDefaultWindow()?.navigator?.clipboard,
    message = getDefaultWindow()?.$message
  } = {}
) => {
  try {
    await clipboard?.writeText(String(value || ''))
    message?.success(successMessage)
  } catch {
    message?.error('复制失败，请重试。')
  }
}

export const downloadWedding3x3JsonPreview = (
  jsonPreview,
  {
    BlobCtor = globalThis.Blob,
    documentRef = getDefaultWindow()?.document,
    message = getDefaultWindow()?.$message,
    now = Date.now,
    setTimeoutRef = getDefaultWindow()?.setTimeout?.bind(getDefaultWindow()) ?? globalThis.setTimeout,
    urlApi = getDefaultWindow()?.URL ?? globalThis.URL
  } = {}
) => {
  try {
    const blob = new BlobCtor([jsonPreview], { type: 'application/json;charset=utf-8' })
    const href = urlApi.createObjectURL(blob)
    const link = documentRef.createElement('a')
    link.href = href
    link.download = `wedding-3x3-${now()}.json`
    documentRef.body.appendChild(link)
    link.click()
    documentRef.body.removeChild(link)
    setTimeoutRef(() => urlApi.revokeObjectURL(href), 800)
  } catch {
    message?.error('JSON 下载失败。')
  }
}
