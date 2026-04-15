const normalize360 = (value) => {
  const numeric = Number(value) || 0
  const remainder = numeric % 360
  return remainder < 0 ? remainder + 360 : remainder
}

export const describeMultiAngleAzimuth = (value) => {
  const normalized = normalize360(value)
  if (normalized < 22 || normalized >= 338) {
    return 'front-facing view, with the subject facing the camera'
  }
  if (normalized < 68) {
    return 'front-left three-quarter view, with the subject turned about halfway away from the camera'
  }
  if (normalized < 112) {
    return 'left side profile, showing the subject from the left side, not a front view'
  }
  if (normalized < 158) {
    return 'rear-left three-quarter view, showing mostly the back with the left side still visible'
  }
  if (normalized < 202) {
    return 'back view, showing the subject from behind, not showing the face'
  }
  if (normalized < 248) {
    return 'rear-right three-quarter view, showing mostly the back with the right side still visible'
  }
  if (normalized < 292) {
    return 'right side profile, showing the subject from the right side, not a front view'
  }
  return 'front-right three-quarter view, with the subject turned about halfway away from the camera'
}

export const describeMultiAngleElevation = (value) => {
  const safe = Number(value) || 0
  if (safe <= -8) {
    return 'low-angle view from below, looking upward at the subject'
  }
  if (safe <= 12) {
    return 'eye level view, with the camera at the same height as the subject'
  }
  if (safe <= 38) {
    return 'slightly elevated view from above eye level, looking gently downward'
  }
  return 'overhead high-angle view from above, looking downward and showing the top of the subject, not an eye-level view'
}

export const describeMultiAngleShotType = (value) => {
  const safe = Number(value) || 0
  if (safe <= 2.5) return 'wide shot'
  if (safe <= 5.5) return 'medium-wide shot'
  if (safe <= 7.5) return 'medium shot'
  return 'medium close-up'
}

export const buildMultiAnglePrompt = ({ azimuth = 0, elevation = 0, zoom = 4.2 } = {}) => {
  const safeElevation = Math.round(Number(elevation) || 0)
  const safeZoom = Number(Number(zoom || 0).toFixed(1))
  const horizontalView = describeMultiAngleAzimuth(azimuth)
  const verticalView = describeMultiAngleElevation(safeElevation)
  const shot = describeMultiAngleShotType(safeZoom)

  const promptParts = [
    'Image 1 (Subject): The main subject to be re-photographed.',
    `Target camera view: ${horizontalView}.`,
    `Target camera height: ${verticalView}.`,
    `Target framing: ${shot}.`,
    'Generate the new image from this target viewpoint, changing the visible side of the subject and the visible background details accordingly.',
    'Do not keep the original camera angle if it conflicts with the requested target view.',
    'Appropriately adjust the background, perspective, and newly visible scene details to match the new camera angle naturally, while preserving the subject identity, outfit, lighting mood, and overall scene coherence.'
  ]

  return promptParts.join(' ')
}
