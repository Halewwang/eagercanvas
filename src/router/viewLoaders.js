export const loadCanvasView = () => import('@/views/Canvas.vue')
export const preloadCanvasView = () => loadCanvasView().catch(() => null)
