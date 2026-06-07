<template>
  <Teleport v-if="lines.length && flowLayerReady" to=".vue-flow__edge-labels">
    <svg ref="svgRef" class="canvas-group-output-lines" aria-hidden="true">
      <g
        v-for="(line, lineIndex) in lines"
        :key="line.id"
        class="canvas-group-output-line-group"
        :class="{ 'is-pending': line.pending, 'is-selected': selectedLineId === line.id }"
      >
        <path
          v-if="selectable && !line.pending"
          class="canvas-group-output-line-hit"
          :data-line-id="line.id"
          :d="getLineGeometry(line).path"
          :stroke-width="GROUP_OUTPUT_LINE_HIT_STROKE_WIDTH"
        />
        <path
          class="canvas-group-output-line"
          :d="getLineGeometry(line).path"
          :stroke-width="getLineStrokeWidth(line)"
        />
        <circle
          class="canvas-group-output-line-dot canvas-group-output-line-dot-source"
          :cx="getLineGeometry(line).source.x"
          :cy="getLineGeometry(line).source.y"
          :r="getDotRadius()"
        />
        <circle
          class="canvas-group-output-line-dot canvas-group-output-line-dot-target"
          :cx="getLineGeometry(line).target.x"
          :cy="getLineGeometry(line).target.y"
          :r="getDotRadius()"
        />
        <g
          v-if="shouldShowLineLabel(line)"
          class="canvas-group-output-line-label"
          :transform="`translate(${getLineGeometry(line).label.x}, ${getLineGeometry(line).label.y})`"
        >
          <circle
            class="canvas-group-output-line-label-bg"
            :r="getLabelRadius()"
            :stroke-width="getLabelStrokeWidth()"
          />
          <text
            class="canvas-group-output-line-label-text"
            text-anchor="middle"
            dominant-baseline="central"
            :font-size="getLabelFontSize()"
          >
            {{ getLineLabel(line, lineIndex) }}
          </text>
        </g>
      </g>
    </svg>
  </Teleport>
</template>

<script setup>
import { getBezierPath } from '@vue-flow/core'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  lines: {
    type: Array,
    default: () => []
  },
  selectedLineId: {
    type: String,
    default: ''
  },
  selectable: {
    type: Boolean,
    default: true
  },
  zoom: {
    type: Number,
    default: 1
  }
})
const emit = defineEmits(['selectLine'])
const svgRef = ref(null)
const flowLayerReady = ref(false)
let flowLayerRafId = null
let flowLayerRetryCount = 0

const GROUP_OUTPUT_LINE_ENDPOINT_GAP = 25
const GROUP_OUTPUT_LINE_HIT_STROKE_WIDTH = 18
const GROUP_OUTPUT_LINE_DOT_RADIUS = 3
const GROUP_OUTPUT_LINE_LABEL_RADIUS = 12
const GROUP_OUTPUT_LINE_LABEL_FONT_SIZE = 12
const GROUP_OUTPUT_LINE_FLOW_LAYER_SELECTOR = '.vue-flow__edge-labels'
const GROUP_OUTPUT_LINE_FLOW_LAYER_RETRY_LIMIT = 60

const getLineStrokeWidth = (line = {}) => (props.selectedLineId === line.id && !line.pending ? 2 : 1)
const getDotRadius = () => GROUP_OUTPUT_LINE_DOT_RADIUS
const getLabelRadius = () => GROUP_OUTPUT_LINE_LABEL_RADIUS
const getLabelFontSize = () => GROUP_OUTPUT_LINE_LABEL_FONT_SIZE
const getLabelStrokeWidth = () => 1
const shouldShowLineLabel = (line = {}) => !line.pending
const getLineLabel = (line = {}, index = 0) => line.order || index + 1
const getPointDistance = (point = {}, target = {}) => Math.hypot(
  (Number(point.x) || 0) - (Number(target.x) || 0),
  (Number(point.y) || 0) - (Number(target.y) || 0)
)

const getSegmentDistance = (point = {}, start = {}, end = {}) => {
  const startX = Number(start.x) || 0
  const startY = Number(start.y) || 0
  const endX = Number(end.x) || 0
  const endY = Number(end.y) || 0
  const dx = endX - startX
  const dy = endY - startY
  const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return getPointDistance(point, start)
  const t = Math.max(0, Math.min(1, (((Number(point.x) || 0) - startX) * dx + ((Number(point.y) || 0) - startY) * dy) / lengthSquared))
  return getPointDistance(point, {
    x: startX + t * dx,
    y: startY + t * dy
  })
}

const getCubicPoint = (points = {}, t = 0) => {
  const u = 1 - t
  return {
    x: u ** 3 * points.start.x + 3 * u ** 2 * t * points.controlA.x + 3 * u * t ** 2 * points.controlB.x + t ** 3 * points.end.x,
    y: u ** 3 * points.start.y + 3 * u ** 2 * t * points.controlA.y + 3 * u * t ** 2 * points.controlB.y + t ** 3 * points.end.y
  }
}

const getCubicPointsFromPath = (path = '') => {
  const values = String(path).match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number) || []
  if (values.length < 8) return null
  return {
    start: { x: values[0], y: values[1] },
    controlA: { x: values[2], y: values[3] },
    controlB: { x: values[4], y: values[5] },
    end: { x: values[6], y: values[7] }
  }
}

const getLineGeometry = (line = {}) => {
  const sourceX = Number(line.source?.x) || 0
  const sourceY = Number(line.source?.y) || 0
  const targetX = Number(line.target?.x) || 0
  const targetY = Number(line.target?.y) || 0
  const direction = targetX >= sourceX ? 1 : -1
  const distance = Math.abs(targetX - sourceX)
  const maxGap = Math.max(0, (distance - (GROUP_OUTPUT_LINE_DOT_RADIUS * 4)) / 2)
  const sourceGap = Math.min(GROUP_OUTPUT_LINE_ENDPOINT_GAP, maxGap)
  const targetGap = 0
  const source = {
    x: sourceX + direction * sourceGap,
    y: sourceY
  }
  const target = {
    x: targetX - direction * targetGap,
    y: targetY
  }
  const [path] = getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition: 'right',
    targetPosition: 'left'
  })
  return {
    source,
    target,
    label: {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2
    },
    path
  }
}

const selectLine = (line = {}) => {
  if (!props.selectable || line.pending || !line.id) return
  emit('selectLine', line.id)
}

const getLocalPointerPoint = (event = {}) => {
  const svg = svgRef.value
  if (!svg) return null
  const point = {
    x: Number(event.clientX) || 0,
    y: Number(event.clientY) || 0
  }
  const ctm = svg.getScreenCTM?.()
  if (!ctm?.inverse) return null
  const inverse = ctm.inverse()
  if (typeof svg.createSVGPoint === 'function') {
    const svgPoint = svg.createSVGPoint()
    svgPoint.x = point.x
    svgPoint.y = point.y
    return svgPoint.matrixTransform(inverse)
  }
  if (typeof DOMPoint === 'function') {
    return new DOMPoint(point.x, point.y).matrixTransform(inverse)
  }
  return {
    x: inverse.a * point.x + inverse.c * point.y + inverse.e,
    y: inverse.b * point.x + inverse.d * point.y + inverse.f
  }
}

const getLocalPointerPointFromRect = (event = {}) => {
  const svg = svgRef.value
  if (!svg?.getBoundingClientRect) return null
  const rect = svg.getBoundingClientRect()
  const scaleX = rect.width / (svg.clientWidth || rect.width || 1)
  const scaleY = rect.height / (svg.clientHeight || rect.height || 1)
  if (!scaleX || !scaleY) return null
  return {
    x: ((Number(event.clientX) || 0) - rect.left) / scaleX,
    y: ((Number(event.clientY) || 0) - rect.top) / scaleY
  }
}

const isPointNearLabel = (line = {}, point = {}) => {
  if (!shouldShowLineLabel(line)) return false
  const { label } = getLineGeometry(line)
  return getPointDistance(point, label) <= getLabelRadius() + 4
}

const isPointInStrokePath = (path, point = {}) => {
  if (typeof path?.isPointInStroke !== 'function') return false
  try {
    return path.isPointInStroke(point)
  } catch {
    return false
  }
}

const isPointNearLinePath = (line = {}, point = {}) => {
  const { path } = getLineGeometry(line)
  const cubic = getCubicPointsFromPath(path)
  if (!cubic) return false
  let previous = cubic.start
  for (let index = 1; index <= 40; index += 1) {
    const next = getCubicPoint(cubic, index / 40)
    if (getSegmentDistance(point, previous, next) <= GROUP_OUTPUT_LINE_HIT_STROKE_WIDTH / 2) return true
    previous = next
  }
  return false
}

const findLineAtPointer = (event = {}) => {
  const svg = svgRef.value
  const point = getLocalPointerPoint(event) || getLocalPointerPointFromRect(event)
  if (!svg || !point) return null

  const hitPaths = Array.from(svg.querySelectorAll('.canvas-group-output-line-hit'))
  const hitPath = hitPaths.find((path) => {
    return isPointInStrokePath(path, point)
  })
  const lineId = hitPath?.dataset?.lineId
  if (lineId) return props.lines.find((line) => line?.id === lineId) || null
  const pathLine = props.lines.find((line) => !line.pending && isPointNearLinePath(line, point))
  if (pathLine) return pathLine
  return props.lines.find((line) => !line.pending && isPointNearLabel(line, point)) || null
}

const handleDocumentPointerDown = (event = {}) => {
  if (!props.selectable) return
  if (event.button !== undefined && event.button !== 0) return
  const line = findLineAtPointer(event)
  if (!line) return
  event.preventDefault?.()
  event.stopPropagation?.()
  selectLine(line)
}

const updateFlowLayerReady = () => {
  const ready = !!document.querySelector(GROUP_OUTPUT_LINE_FLOW_LAYER_SELECTOR)
  flowLayerReady.value = ready
  return ready
}

const scheduleFlowLayerReadyUpdate = () => {
  if (flowLayerRafId !== null) {
    window.cancelAnimationFrame(flowLayerRafId)
  }
  flowLayerRafId = window.requestAnimationFrame(() => {
    flowLayerRafId = null
    if (updateFlowLayerReady()) return
    if (flowLayerRetryCount >= GROUP_OUTPUT_LINE_FLOW_LAYER_RETRY_LIMIT) return
    flowLayerRetryCount += 1
    scheduleFlowLayerReadyUpdate()
  })
}

onMounted(() => {
  nextTick(() => {
    scheduleFlowLayerReadyUpdate()
  })
  window.addEventListener('pointerdown', handleDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  if (flowLayerRafId !== null) {
    window.cancelAnimationFrame(flowLayerRafId)
    flowLayerRafId = null
  }
  window.removeEventListener('pointerdown', handleDocumentPointerDown, true)
})
</script>

<style scoped>
.canvas-group-output-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.canvas-group-output-line-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 18;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.canvas-group-output-line {
  fill: none;
  stroke: #ffffff;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.canvas-group-output-line-label {
  pointer-events: none;
}

.canvas-group-output-line-label-bg {
  fill: #ffffff;
  stroke: rgba(17, 17, 17, 0.22);
}

.canvas-group-output-line-label-text {
  fill: #000000;
  font-family: inherit;
  font-weight: 700;
  pointer-events: none;
  user-select: none;
}

.canvas-group-output-line-dot {
  fill: #ffffff;
  pointer-events: none;
}

.canvas-group-output-line-group.is-pending .canvas-group-output-line {
  stroke-dasharray: 6 6;
}
</style>
