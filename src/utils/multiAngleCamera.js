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

export const toModelHorizontalAngle = (azimuth) => normalize360(360 - normalize360(azimuth))

const toUiAzimuth = (value) => normalize360(360 - normalize360(value))

const describeAzimuth = (azimuth) => {
  const safe = normalize360(azimuth)
  if (safe >= 337.5 || safe < 22.5) return 'front view'
  if (safe < 67.5) return 'front-left three-quarter view'
  if (safe < 112.5) return 'left side profile view'
  if (safe < 157.5) return 'rear-left three-quarter view'
  if (safe < 202.5) return 'back view'
  if (safe < 247.5) return 'rear-right three-quarter view'
  if (safe < 292.5) return 'right side profile view'
  return 'front-right three-quarter view'
}

const describeElevation = (elevation) => {
  const safe = clamp(Number(elevation) || 0, -30, 90)
  if (safe <= -15) return 'low-angle view'
  if (safe < -4) return 'slightly low view'
  if (safe <= 4) return 'eye-level view'
  if (safe < 25) return 'slightly high view'
  if (safe < 65) return 'high-angle view'
  return 'overhead bird-eye view'
}

const describeZoom = (zoom) => {
  const safe = clamp(Number(zoom) || 0, 0, 10)
  if (safe < 3) return 'wide framing'
  if (safe < 7) return 'medium framing'
  return 'close-up framing'
}

export const buildMultiAngleCameraInput = ({ azimuth = 0, elevation = 0, zoom = 4.2 } = {}) => ({
  horizontal_angle: roundTo(toModelHorizontalAngle(azimuth), 0),
  vertical_angle: roundTo(clamp(Number(elevation) || 0, -30, 90), 0),
  zoom: roundTo(clamp(Number(zoom) || 0, 0, 10), 1)
})

export const buildMultiAngleCameraPrompt = ({
  azimuth,
  elevation,
  horizontal_angle = 0,
  vertical_angle = 0,
  zoom = 4.2
} = {}) => {
  const promptAzimuth = azimuth === undefined ? toUiAzimuth(horizontal_angle) : normalize360(azimuth)
  const promptElevation = elevation === undefined
    ? clamp(Number(vertical_angle) || 0, -30, 90)
    : clamp(Number(elevation) || 0, -30, 90)
  const promptZoom = clamp(Number(zoom) || 0, 0, 10)

  return [
    'Change only the camera viewpoint of the provided image.',
    `Target view: ${describeAzimuth(promptAzimuth)}, about ${roundTo(promptAzimuth, 0)} degrees around the image content from the front.`,
    `Target elevation: ${describeElevation(promptElevation)}, about ${roundTo(promptElevation, 0)} degrees vertical.`,
    `Target framing: ${describeZoom(promptZoom)}, zoom=${roundTo(promptZoom, 1)} on a 0 wide to 10 close scale.`,
    'Keep the existing visual content, style, colors, lighting, proportions, and composition consistent.'
  ].join(' ')
}
