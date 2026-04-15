const normalize360 = (value) => {
  const numeric = Number(value) || 0
  const remainder = numeric % 360
  return remainder < 0 ? remainder + 360 : remainder
}

export const describeMultiAngleAzimuth = (value) => {
  const normalized = normalize360(value)
  if (normalized < 22 || normalized >= 338) return 'front view'
  if (normalized < 68) return 'front-left three-quarter view'
  if (normalized < 112) return 'left side view'
  if (normalized < 158) return 'rear-left three-quarter view'
  if (normalized < 202) return 'back view'
  if (normalized < 248) return 'rear-right three-quarter view'
  if (normalized < 292) return 'right side view'
  return 'front-right three-quarter view'
}

export const describeMultiAngleElevation = (value) => {
  const safe = Number(value) || 0
  if (safe <= -8) return 'low angle, looking upward'
  if (safe <= 12) return 'eye level'
  if (safe <= 38) return 'slightly elevated angle'
  return 'high angle from above, looking downward'
}

export const describeMultiAngleShotType = (value) => {
  const safe = Number(value) || 0
  if (safe <= 2.5) return 'wide shot'
  if (safe <= 5.5) return 'medium-wide shot'
  if (safe <= 7.5) return 'medium shot'
  return 'medium close-up'
}

export const buildMultiAnglePrompt = ({ azimuth = 0, elevation = 0, zoom = 4.2 } = {}) => {
  const safeAzimuth = Math.round(Number(azimuth) || 0)
  const safeElevation = Math.round(Number(elevation) || 0)
  const safeZoom = Number(Number(zoom || 0).toFixed(1))
  const view = describeMultiAngleAzimuth(safeAzimuth)
  const vertical = describeMultiAngleElevation(safeElevation)
  const shot = describeMultiAngleShotType(safeZoom)

  const promptParts = [
    'Image 1 (Subject): The main subject to be re-photographed.',
    `Camera control: azimuth: ${safeAzimuth}°, elevation: ${safeElevation}°, zoom: ${safeZoom}.`,
    `Use these camera controls as the primary generation target: ${view}, ${vertical}, ${shot}.`,
    'Rotate the camera viewpoint around the subject to match the azimuth, change the vertical camera height to match the elevation, and adjust framing to match the zoom.',
    'Appropriately adjust the background, perspective, and newly visible scene details to match the new camera angle naturally, while preserving the subject identity, outfit, lighting mood, and overall scene coherence.'
  ]

  return promptParts.join(' ')
}
