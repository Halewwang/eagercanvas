<template>
  <div class="model3d-shell">
    <div
      v-if="activeViewerUrl && !loadError"
      class="model3d-media-shell nodrag nopan"
      @pointerdown.stop
      @mousedown.stop
      @click.stop
    >
      <model-viewer
        ref="modelViewerRef"
        class="model3d-viewer"
        :src="activeViewerUrl"
        camera-target="auto auto auto"
        :camera-orbit="cameraOrbit"
        interaction-prompt="none"
        shadow-intensity="1"
        exposure="1"
        ar-status="not-presenting"
        disable-pan
        @load="handleModelViewerLoad"
        @error="handleModelViewerError"
      />
    </div>

    <div
      v-else-if="canRenderObj && !loadError"
      ref="objStageRef"
      class="model3d-media-shell model3d-obj-shell nodrag nopan"
      @pointerdown.stop.prevent="handleObjPointerDown"
      @mousedown.stop
      @click.stop
    />

    <div v-else-if="previewImageUrl" class="module-image-shell">
      <div class="module-image-frame">
        <img :src="previewImageUrl" :alt="alt" class="module-image" />
      </div>
    </div>

    <div v-else class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-2 text-center px-4">
      <n-icon :size="32" class="text-[#7b818c]"><AppsOutline /></n-icon>
      <span class="text-sm text-[#7b818c]">{{ emptyLabel }}</span>
    </div>

    <div v-if="loadError" class="model3d-error-banner">
      {{ loadError }}
    </div>

    <div
      v-if="showControls"
      class="model3d-controls model3d-controls-left nodrag nopan"
      @mousedown.stop
      @pointerdown.stop
      @click.stop
    >
      <button class="model3d-control-btn" title="Zoom Out" @click.stop="zoomOut">
        <n-icon :size="14"><RemoveOutline /></n-icon>
      </button>
      <button class="model3d-control-btn" title="Zoom In" @click.stop="zoomIn">
        <n-icon :size="14"><AddOutline /></n-icon>
      </button>
    </div>

    <div
      v-if="showControls"
      class="model3d-controls model3d-controls-right nodrag nopan"
      @mousedown.stop
      @pointerdown.stop
      @click.stop
    >
      <div
        ref="cubeRef"
        class="model3d-viewcube-wrap"
        @pointerdown.stop.prevent="handleCubePointerDown"
        @click.stop
      >
        <div class="model3d-viewcube" :style="cubeStyle">
          <button class="model3d-cube-face model3d-cube-face-front" title="Front View" @click.stop="setViewPreset('front')">F</button>
          <button class="model3d-cube-face model3d-cube-face-back" title="Back View" @click.stop="setViewPreset('back')">B</button>
          <button class="model3d-cube-face model3d-cube-face-left" title="Left View" @click.stop="setViewPreset('left')">L</button>
          <button class="model3d-cube-face model3d-cube-face-right" title="Right View" @click.stop="setViewPreset('right')">R</button>
          <button class="model3d-cube-face model3d-cube-face-top" title="Top View" @click.stop="setViewPreset('top')">T</button>
          <button class="model3d-cube-face model3d-cube-face-bottom" title="Bottom View" @click.stop="setViewPreset('bottom')">D</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@google/model-viewer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { AddOutline, AppsOutline, RemoveOutline } from '../../icons/coolicons'

const props = defineProps({
  url: { type: String, default: '' },
  assetUrls: { type: Object, default: () => ({}) },
  previewImageUrl: { type: String, default: '' },
  alt: { type: String, default: '3D preview' },
  emptyLabel: { type: String, default: 'Run the 3D config node to preview the model here' },
  showControls: { type: Boolean, default: true }
})

const modelViewerRef = ref(null)
const objStageRef = ref(null)
const cubeRef = ref(null)
const VIEW_PRESETS = {
  front: { azimuth: 0, elevation: 72 },
  right: { azimuth: 90, elevation: 72 },
  back: { azimuth: 180, elevation: 72 },
  left: { azimuth: -90, elevation: 72 },
  top: { azimuth: 0, elevation: 8 },
  bottom: { azimuth: 0, elevation: 160 }
}

const viewerUrl = computed(() => {
  const directUrl = String(props.url || '').trim()
  if (/\.glb($|\?)/i.test(directUrl)) return directUrl
  return String(props.assetUrls?.glb || '').trim()
})
const objUrl = computed(() => {
  const directUrl = String(props.url || '').trim()
  if (/\.obj($|\?)/i.test(directUrl)) return directUrl
  return String(props.assetUrls?.obj || '').trim()
})
const preferObjFallback = ref(false)
const activeViewerUrl = computed(() => (preferObjFallback.value ? '' : viewerUrl.value))
const canRenderObj = computed(() => !!objUrl.value && (!activeViewerUrl.value || preferObjFallback.value))

const orbitAngle = ref(0)
const elevationAngle = ref(72)
const zoomPercent = ref(118)
const cameraOrbit = computed(() => `${orbitAngle.value}deg ${elevationAngle.value}deg ${zoomPercent.value}%`)
const cubeRotationX = ref(-22)
const cubeRotationY = ref(-30)
const loadError = ref('')
const cubeStyle = computed(() => ({
  transform: `rotateX(${cubeRotationX.value}deg) rotateY(${cubeRotationY.value}deg)`
}))

let cubeDragPointerId = null
let cubeDragStartX = 0
let cubeDragStartY = 0
let cubeStartRotationX = 0
let cubeStartRotationY = 0

let objRenderer = null
let objScene = null
let objCamera = null
let objAnimationFrame = 0
let objLoadToken = 0
let objTargetY = 0
let objBaseDistance = 4
let objDragPointerId = null
let objDragStartX = 0
let objDragStartY = 0
let objStartOrbit = 0
let objStartElevation = 72

const handleModelViewerLoad = async () => {
  const viewer = modelViewerRef.value
  if (!viewer) return

  preferObjFallback.value = false
  loadError.value = ''
  orbitAngle.value = 0
  elevationAngle.value = 72
  zoomPercent.value = 100
  syncCubeToCamera()

  try {
    await viewer.updateFraming?.()
    viewer.cameraTarget = 'auto auto auto'
    viewer.jumpCameraToGoal?.()
  } catch (error) {
    console.warn('model-viewer framing failed', error)
  }
}

const handleModelViewerError = (event) => {
  const detailMessage = String(event?.detail?.message || '').trim()
  if (objUrl.value) {
    preferObjFallback.value = true
    loadError.value = ''
    console.warn('model-viewer load failed, falling back to OBJ preview', {
      viewerUrl: viewerUrl.value,
      objUrl: objUrl.value,
      event
    })
    return
  }
  loadError.value = detailMessage || '3D model failed to load in viewer'
  console.error('model-viewer load failed', {
    url: viewerUrl.value,
    event
  })
}

const stopObjLoop = () => {
  if (objAnimationFrame) {
    cancelAnimationFrame(objAnimationFrame)
    objAnimationFrame = 0
  }
}

const renderObjScene = () => {
  if (!objRenderer || !objScene || !objCamera) return
  objAnimationFrame = requestAnimationFrame(renderObjScene)
  objRenderer.render(objScene, objCamera)
}

const syncObjCamera = () => {
  if (!objCamera) return
  const radius = objBaseDistance * (zoomPercent.value / 100)
  const radians = (orbitAngle.value * Math.PI) / 180
  const verticalRadians = (elevationAngle.value * Math.PI) / 180
  const y = Math.cos(verticalRadians) * radius
  const planar = Math.sin(verticalRadians) * radius
  objCamera.position.set(Math.sin(radians) * planar, y, Math.cos(radians) * planar)
  objCamera.lookAt(0, objTargetY, 0)
  objCamera.updateProjectionMatrix()
  objRenderer?.render(objScene, objCamera)
}

const syncCubeToCamera = () => {
  cubeRotationY.value = orbitAngle.value - 30
  cubeRotationX.value = Math.max(-88, Math.min(88, 68 - elevationAngle.value))
}

const syncCameraToCube = () => {
  orbitAngle.value = cubeRotationY.value + 30
  elevationAngle.value = Math.max(8, Math.min(160, 68 - cubeRotationX.value))
  syncObjCamera()
}

const disposeObjViewer = () => {
  objLoadToken += 1
  stopObjLoop()
  if (objRenderer) {
    objRenderer.dispose()
    objRenderer.domElement?.remove()
    objRenderer = null
  }
  objScene = null
  objCamera = null
  objTargetY = 0
  objBaseDistance = 4
}

const mountObjViewer = async () => {
  if (!canRenderObj.value || !objStageRef.value) return

  disposeObjViewer()
  await nextTick()
  loadError.value = ''

  const host = objStageRef.value
  const width = Math.max(1, host.clientWidth)
  const height = Math.max(1, host.clientHeight)
  const loadToken = objLoadToken + 1
  objLoadToken = loadToken

  objScene = new THREE.Scene()
  objScene.background = new THREE.Color('#0f0f0f')

  objCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000)
  objRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  objRenderer.setPixelRatio(window.devicePixelRatio || 1)
  objRenderer.setSize(width, height)
  host.innerHTML = ''
  host.appendChild(objRenderer.domElement)

  objScene.add(new THREE.AmbientLight(0xffffff, 1.5))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2)
  keyLight.position.set(4, 6, 5)
  objScene.add(keyLight)

  const rimLight = new THREE.DirectionalLight(0xf1f3f6, 0.5)
  rimLight.position.set(-5, 2, -4)
  objScene.add(rimLight)

  const ground = new THREE.GridHelper(8, 8, 0x2a2d33, 0x181a1f)
  ground.position.y = -1.2
  objScene.add(ground)

  const scene = objScene
  const camera = objCamera

  new OBJLoader().load(
    objUrl.value,
    (object) => {
      if (loadToken !== objLoadToken || !scene || !camera) return

      object.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#d7dbe3',
            metalness: 0.28,
            roughness: 0.58
          })
        }
      })

      const box = new THREE.Box3().setFromObject(object)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      object.position.sub(center)
      scene.add(object)

      const maxDim = Math.max(size.x, size.y, size.z, 1)
      objBaseDistance = maxDim * 1.45
      objTargetY = 0
      camera.near = Math.max(0.1, maxDim / 100)
      camera.far = Math.max(1000, maxDim * 20)
      orbitAngle.value = 0
      elevationAngle.value = 72
      zoomPercent.value = 100
      syncCubeToCamera()
      syncObjCamera()
      renderObjScene()
    },
    undefined,
    (error) => {
      if (loadToken !== objLoadToken) return
      loadError.value = error?.message || 'OBJ preview failed to load'
      console.error('OBJ preview load failed', error)
    }
  )
}

const setViewPreset = (viewKey) => {
  const preset = VIEW_PRESETS[viewKey]
  if (!preset) return
  orbitAngle.value = preset.azimuth
  elevationAngle.value = preset.elevation
  syncCubeToCamera()
  syncObjCamera()
}

const handleCubePointerMove = (event) => {
  if (cubeDragPointerId == null || event.pointerId !== cubeDragPointerId) return
  const dx = event.clientX - cubeDragStartX
  const dy = event.clientY - cubeDragStartY
  cubeRotationY.value = cubeStartRotationY + dx * 0.45
  cubeRotationX.value = Math.max(-88, Math.min(88, cubeStartRotationX - dy * 0.35))
  syncCameraToCube()
}

const handleCubePointerUp = (event) => {
  if (cubeDragPointerId == null || event.pointerId !== cubeDragPointerId) return
  cubeDragPointerId = null
  window.removeEventListener('pointermove', handleCubePointerMove)
  window.removeEventListener('pointerup', handleCubePointerUp)
}

const handleCubePointerDown = (event) => {
  cubeDragPointerId = event.pointerId
  cubeDragStartX = event.clientX
  cubeDragStartY = event.clientY
  cubeStartRotationX = cubeRotationX.value
  cubeStartRotationY = cubeRotationY.value
  window.addEventListener('pointermove', handleCubePointerMove)
  window.addEventListener('pointerup', handleCubePointerUp)
}

const handleObjPointerMove = (event) => {
  if (objDragPointerId == null || event.pointerId !== objDragPointerId) return
  const dx = event.clientX - objDragStartX
  const dy = event.clientY - objDragStartY
  orbitAngle.value = objStartOrbit + dx * 0.45
  elevationAngle.value = Math.max(8, Math.min(160, objStartElevation - dy * 0.3))
  syncCubeToCamera()
  syncObjCamera()
}

const handleObjPointerUp = (event) => {
  if (objDragPointerId == null || event.pointerId !== objDragPointerId) return
  objDragPointerId = null
  window.removeEventListener('pointermove', handleObjPointerMove)
  window.removeEventListener('pointerup', handleObjPointerUp)
}

const handleObjPointerDown = (event) => {
  if (!canRenderObj.value) return
  objDragPointerId = event.pointerId
  objDragStartX = event.clientX
  objDragStartY = event.clientY
  objStartOrbit = orbitAngle.value
  objStartElevation = elevationAngle.value
  window.addEventListener('pointermove', handleObjPointerMove)
  window.addEventListener('pointerup', handleObjPointerUp)
}

const zoomIn = () => {
  zoomPercent.value = Math.max(55, zoomPercent.value - 10)
  syncObjCamera()
}

const zoomOut = () => {
  zoomPercent.value = Math.min(180, zoomPercent.value + 10)
  syncObjCamera()
}

watch(canRenderObj, async (enabled) => {
  loadError.value = ''
  if (enabled) {
    await mountObjViewer()
    return
  }
  disposeObjViewer()
}, { immediate: true })

watch(objUrl, async () => {
  loadError.value = ''
  if (!canRenderObj.value) return
  await mountObjViewer()
})

watch(viewerUrl, () => {
  preferObjFallback.value = false
  loadError.value = ''
})

onMounted(async () => {
  syncCubeToCamera()
  if (!canRenderObj.value) return
  await mountObjViewer()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleCubePointerMove)
  window.removeEventListener('pointerup', handleCubePointerUp)
  window.removeEventListener('pointermove', handleObjPointerMove)
  window.removeEventListener('pointerup', handleObjPointerUp)
  disposeObjViewer()
})
</script>

<style scoped>
.model3d-shell {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0f0f0f;
}

.model3d-media-shell {
  width: 100%;
  height: 100%;
}

.model3d-viewer {
  width: 100%;
  height: 100%;
  --poster-color: transparent;
  background: transparent;
  pointer-events: auto;
}

.model3d-obj-shell {
  overflow: hidden;
}

.model3d-obj-shell :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  pointer-events: auto;
  cursor: grab;
}

.model3d-obj-shell:active :deep(canvas) {
  cursor: grabbing;
}

.model3d-controls {
  position: absolute;
  bottom: 18px;
  display: inline-flex;
  gap: 8px;
  z-index: 4;
  align-items: flex-end;
  min-height: 56px;
}

.model3d-controls-left {
  left: 12px;
}

.model3d-controls-right {
  right: 12px;
}

.model3d-control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(15, 15, 15, 0.94);
  color: #eef2f7;
  backdrop-filter: blur(10px);
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.model3d-viewcube-wrap {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  perspective: 500px;
  cursor: grab;
  align-self: flex-end;
}

.model3d-viewcube-wrap:active {
  cursor: grabbing;
}

.model3d-viewcube {
  position: relative;
  width: 32px;
  height: 32px;
  transform-style: preserve-3d;
  transition: transform 0.12s ease-out;
}

.model3d-cube-face {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(15, 15, 15, 0.94);
  color: #eef2f7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.model3d-cube-face-front { transform: translateZ(16px); }
.model3d-cube-face-back { transform: rotateY(180deg) translateZ(16px); }
.model3d-cube-face-left { transform: rotateY(-90deg) translateZ(16px); }
.model3d-cube-face-right { transform: rotateY(90deg) translateZ(16px); }
.model3d-cube-face-top { transform: rotateX(90deg) translateZ(16px); }
.model3d-cube-face-bottom { transform: rotateX(-90deg) translateZ(16px); }

.model3d-cube-face:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(28, 31, 38, 0.96);
}

.model3d-control-btn:hover {
  background: rgba(28, 31, 38, 0.94);
  border-color: rgba(255, 255, 255, 0.28);
}

.model3d-control-btn:active {
  transform: scale(0.96);
}

.model3d-error-banner {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 12px;
  z-index: 5;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(63, 17, 17, 0.84);
  color: #fecaca;
  padding: 8px 10px;
  font-size: 11px;
  line-height: 1.4;
  backdrop-filter: blur(10px);
}
</style>
