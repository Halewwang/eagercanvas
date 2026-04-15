export const QWEN_MULTI_ANGLE_MODEL = 'fal-ai/qwen-image-edit-2511-multiple-angles'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const normalize360 = (value) => {
  const numeric = Number(value) || 0
  const remainder = numeric % 360
  return remainder < 0 ? remainder + 360 : remainder
}

const roundTo = (value, digits = 0) => {
  const factor = 10 ** digits
  return Math.round((Number(value) || 0) * factor) / factor
}

export const toQwenHorizontalAngle = (azimuth) => normalize360(360 - normalize360(azimuth))

export const buildQwenMultiAngleCameraInput = ({ azimuth = 0, elevation = 0, zoom = 4.2 } = {}) => ({
  model: QWEN_MULTI_ANGLE_MODEL,
  horizontal_angle: roundTo(toQwenHorizontalAngle(azimuth), 0),
  vertical_angle: roundTo(clamp(Number(elevation) || 0, -30, 90), 0),
  zoom: roundTo(clamp(Number(zoom) || 0, 0, 10), 1)
})
