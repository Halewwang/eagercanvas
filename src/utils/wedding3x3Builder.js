import {
  WEDDING_3X3_DEFAULT_MODE,
  WEDDING_3X3_LIMITS
} from '@/config/wedding3x3'

const PRODUCT_MODE = 'product_showcase'
const SCENE_MODE = 'scene_expansion'

const PRODUCT_LOCK_LINES = [
  'Use the reference image as the absolute product reference.',
  'Keep the structural characteristics of the floral product exactly consistent with the reference image.',
  'Do not change the overall silhouette, arrangement shape, layering logic, focal structure, flower distribution, volume balance, height relationship, or proportion.',
  'Do not reinterpret the floral construction into a different form.',
  'The core structure of the product must remain unchanged across all frames.',
  '',
  'Keep the same floral product identity across all nine panels:',
  'same flower types, same arrangement structure, same floral palette, same proportions, same decorative details, and same styling language.',
  'Do not redesign the arrangement into a different product.'
]

const PRODUCT_UNLOCKED_LINES = [
  'Use the reference image as the product reference.',
  'Keep the floral identity, silhouette, and arrangement language closely aligned with the reference image across all nine panels.'
]

const SCENE_LOCK_LINES = [
  'Use the reference image as the floral styling reference.',
  'Keep the structural characteristics of the floral product exactly consistent with the reference image.',
  'Do not change the overall silhouette, arrangement shape, layering logic, focal structure, flower distribution, volume balance, height relationship, or proportion.',
  'Keep the same floral design language, palette logic, arrangement mood, and overall wedding aesthetic across all nine panels.',
  'Do not replace the floral identity with a different style.'
]

const SCENE_UNLOCKED_LINES = [
  'Use the reference image as the floral styling reference.',
  'Keep the floral design language, palette logic, and arrangement mood aligned with the reference image across all nine panels.'
]

const PRODUCT_FRAME_LINES = [
  'FRAME 1: front hero shot of the floral product, centered and clearly readable.',
  'FRAME 2: 45-degree angle showing volume, silhouette, and depth.',
  'FRAME 3: side angle emphasizing structure and layering.',
  'FRAME 4: close-up of flower texture, material transitions, petals, ribbons, stems, or floral craftsmanship.',
  'FRAME 5: product integrated into a suitable wedding setup, showing scale and spatial relationship.',
  'FRAME 6: top or elevated angle revealing composition logic and floral distribution.',
  'FRAME 7: refined detail shot of one premium feature, such as edge detail, petal texture, ribbon wrap, or floral density.',
  'FRAME 8: a bold editorial composition using the selected environment, still keeping the product as the hero.',
  'FRAME 9: wide final composition showing the product in a complete styled wedding context.'
]

const SCENE_FRAME_LINES = [
  'FRAME 1: wide establishing shot of the wedding setting and floral environment.',
  'FRAME 2: medium shot introducing the people within the floral setup.',
  'FRAME 3: interaction moment showing natural body language and emotional connection.',
  'FRAME 4: close-up of hands, bouquet, fabric, veil, or floral detail tied to the story.',
  'FRAME 5: environmental portrait with the floral installation as a framing device.',
  'FRAME 6: movement moment, such as walking, turning, reaching, adjusting, or passing through the space.',
  'FRAME 7: quiet emotional pause, intimate and restrained.',
  'FRAME 8: bold editorial storytelling frame using architecture, props, and flowers in a visually striking composition.',
  'FRAME 9: final wide narrative frame that feels like the emotional conclusion of the series.'
]

const SINGLE_FIELDS = [
  'style',
  'season',
  'color_family',
  'main_color',
  'mood_primary',
  'product_type',
  'greenery_coverage',
  'venue_type',
  'wall_surface',
  'ground_surface',
  'scene_type',
  'relationship_mode',
  'story_action',
  'random_seed'
]

const ARRAY_FIELDS = [
  'mood_tags',
  'greenery_character',
  'props',
  'fabric_material',
  'decor_material',
  'environment_flavor'
]

const PRODUCT_FIELDS = new Set([
  'product_type',
  'greenery_coverage',
  'greenery_character',
  'venue_type',
  'wall_surface',
  'ground_surface',
  'props',
  'fabric_material',
  'decor_material'
])

const SCENE_FIELDS = new Set([
  'scene_type',
  'relationship_mode',
  'story_action',
  'environment_flavor',
  'venue_type',
  'wall_surface',
  'ground_surface',
  'props'
])

const trimString = (value = '') => String(value || '').trim()

const uniqueList = (items = []) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = trimString(item).toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const normalizeList = (items = [], limit = Infinity) =>
  uniqueList(items.map((item) => trimString(item)).filter(Boolean)).slice(0, limit)

const formatValue = (value) => {
  if (Array.isArray(value)) {
    const next = normalizeList(value)
    return next.length ? next.join(', ') : ''
  }
  return trimString(value)
}

const lineIfPresent = (label, value) => {
  const formatted = formatValue(value)
  return formatted ? `${label}: ${formatted}.` : ''
}

export const sanitizeWedding3x3Variables = (mode = PRODUCT_MODE, input = {}) => {
  const normalizedMode = mode === SCENE_MODE ? SCENE_MODE : PRODUCT_MODE
  const output = {}

  SINGLE_FIELDS.forEach((field) => {
    const value = trimString(input[field])
    if (value) output[field] = value
  })

  ARRAY_FIELDS.forEach((field) => {
    const value = normalizeList(input[field], WEDDING_3X3_LIMITS[field] || Infinity)
    if (value.length > 0) output[field] = value
  })

  const scopedFields = normalizedMode === SCENE_MODE ? SCENE_FIELDS : PRODUCT_FIELDS
  Object.keys(output).forEach((field) => {
    if (PRODUCT_FIELDS.has(field) || SCENE_FIELDS.has(field)) {
      if (!scopedFields.has(field)) delete output[field]
    }
  })

  return output
}

export const validateWedding3x3Config = ({
  mode = WEDDING_3X3_DEFAULT_MODE,
  referenceImage = '',
  variables = {}
} = {}) => {
  const errors = []
  const safeMode = mode === SCENE_MODE ? SCENE_MODE : PRODUCT_MODE
  const safeVariables = sanitizeWedding3x3Variables(safeMode, variables)

  if (!trimString(referenceImage)) errors.push('需要参考图后才能生成九宫格。')
  if (!trimString(safeVariables.style)) errors.push('需要选择风格。')

  if (safeMode === PRODUCT_MODE && !trimString(safeVariables.product_type)) {
    errors.push('产品展示模式需要选择产品类型。')
  }

  if (safeMode === SCENE_MODE) {
    if (!trimString(safeVariables.scene_type) && !trimString(safeVariables.relationship_mode)) {
      errors.push('场景扩展模式至少需要场景类型或人物关系其中一项。')
    }
    if (!trimString(safeVariables.story_action)) {
      errors.push('场景扩展模式需要选择故事动作。')
    }
  }

  return errors
}

export const buildWedding3x3Prompt = ({
  mode = PRODUCT_MODE,
  variables = {},
  lockStructure = true
} = {}) => {
  const safeMode = mode === SCENE_MODE ? SCENE_MODE : PRODUCT_MODE
  const safeVariables = sanitizeWedding3x3Variables(safeMode, variables)
  const lines = []

  if (safeMode === PRODUCT_MODE) {
    lines.push('Create a premium 3x3 wedding floral product storyboard grid.')
    lines.push('')
    lines.push(...(lockStructure ? PRODUCT_LOCK_LINES : PRODUCT_UNLOCKED_LINES))
    lines.push('')
    lines.push('This is a high-end editorial floral presentation for a wedding styling portfolio.')
    if (safeVariables.style || safeVariables.season) {
      if (safeVariables.style && safeVariables.season) {
        lines.push(`The overall visual direction is ${safeVariables.style}, with a ${safeVariables.season} seasonal feeling.`)
      } else if (safeVariables.style) {
        lines.push(`The overall visual direction is ${safeVariables.style}.`)
      } else {
        lines.push(`The overall tone carries a ${safeVariables.season} seasonal feeling.`)
      }
    }
    ;[
      lineIfPresent('Color family', safeVariables.color_family),
      lineIfPresent('Main color', safeVariables.main_color),
      lineIfPresent('Mood', safeVariables.mood_primary),
      lineIfPresent('Mood tags', safeVariables.mood_tags),
      lineIfPresent('Greenery coverage', safeVariables.greenery_coverage),
      lineIfPresent('Greenery character', safeVariables.greenery_character),
      lineIfPresent('The product type is', safeVariables.product_type),
      lineIfPresent('Venue', safeVariables.venue_type),
      lineIfPresent('Wall surface', safeVariables.wall_surface),
      lineIfPresent('Ground surface', safeVariables.ground_surface),
      lineIfPresent('Props', safeVariables.props),
      lineIfPresent('Fabric material', safeVariables.fabric_material),
      lineIfPresent('Decor material', safeVariables.decor_material)
    ].filter(Boolean).forEach((line) => lines.push(line))
    lines.push('')
    lines.push('The full series should feel cohesive, refined, romantic, design-driven, and editorial.')
    lines.push('Keep lighting logic, styling language, material rendering, and tonal control consistent across all nine panels.')
    lines.push('')
    lines.push(...PRODUCT_FRAME_LINES)
    lines.push('')
    lines.push('Use ultra high-quality wedding editorial photography.')
    lines.push('Soft but controlled lighting.')
    lines.push('Accurate floral texture.')
    lines.push('Elegant depth of field.')
    lines.push('No text, no watermark, no inconsistent flowers, no distracting props, no human subjects dominating the image.')
    return lines.filter((line, index, source) => line || (source[index - 1] && source[index + 1])).join('\n')
  }

  lines.push('Create a premium 3x3 wedding editorial storyboard grid with floral scene expansion and human storytelling.')
  lines.push('')
  lines.push(...(lockStructure ? SCENE_LOCK_LINES : SCENE_UNLOCKED_LINES))
  lines.push('')
  if (safeVariables.style || safeVariables.season) {
    if (safeVariables.style && safeVariables.season) {
      lines.push(`The visual direction is ${safeVariables.style}, with a ${safeVariables.season} seasonal tone.`)
    } else if (safeVariables.style) {
      lines.push(`The visual direction is ${safeVariables.style}.`)
    } else {
      lines.push(`The overall tone carries a ${safeVariables.season} seasonal tone.`)
    }
  }
  ;[
    lineIfPresent('Color family', safeVariables.color_family),
    lineIfPresent('Main color', safeVariables.main_color),
    lineIfPresent('Mood', safeVariables.mood_primary),
    lineIfPresent('Mood tags', safeVariables.mood_tags),
    lineIfPresent('Scene type', safeVariables.scene_type),
    lineIfPresent('Relationship mode', safeVariables.relationship_mode),
    lineIfPresent('Story action', safeVariables.story_action),
    lineIfPresent('Venue', safeVariables.venue_type),
    lineIfPresent('Environment flavor', safeVariables.environment_flavor),
    lineIfPresent('Wall surface', safeVariables.wall_surface),
    lineIfPresent('Ground surface', safeVariables.ground_surface),
    lineIfPresent('Props', safeVariables.props)
  ].filter(Boolean).forEach((line) => lines.push(line))
  lines.push('')
  lines.push('This series should feel cinematic, emotional, refined, and story-rich.')
  lines.push('The floral installation remains visually important and helps frame the human interaction.')
  lines.push('All nine panels must belong to one cohesive wedding story.')
  lines.push('')
  lines.push(...SCENE_FRAME_LINES)
  lines.push('')
  lines.push('Use high-end wedding editorial photography with cinematic realism.')
  lines.push('Soft wedding light.')
  lines.push('Elegant skin tones.')
  lines.push('Layered composition.')
  lines.push('Subtle depth of field.')
  lines.push('No stiff catalog posing, no chaotic crowding, no random props, no weak floral presence, no disconnected body language.')

  return lines.filter((line, index, source) => line || (source[index - 1] && source[index + 1])).join('\n')
}

export const buildWedding3x3Json = ({
  mode = WEDDING_3X3_DEFAULT_MODE,
  referenceImage = '',
  variables = {},
  generation = {},
  lockStructure = true
} = {}) => {
  const safeMode = mode === SCENE_MODE ? SCENE_MODE : PRODUCT_MODE
  const safeVariables = sanitizeWedding3x3Variables(safeMode, variables)
  const prompt = buildWedding3x3Prompt({
    mode: safeMode,
    variables: safeVariables,
    lockStructure
  })

  return {
    mode: safeMode,
    reference_image: trimString(referenceImage),
    lock_structure: !!lockStructure,
    variables: safeVariables,
    generation: {
      model: trimString(generation.model),
      ratio: trimString(generation.ratio),
      resolution: trimString(generation.resolution),
      quality: trimString(generation.quality),
      size: trimString(generation.size)
    },
    output: {
      prompt,
      debug: {
        tool: 'wedding-3x3',
        frame_count: 9,
        random_seed: safeVariables.random_seed || '',
        rule_hits: [],
        generated_at: new Date().toISOString()
      }
    }
  }
}
