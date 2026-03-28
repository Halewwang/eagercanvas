<template>
  <div class="model3d-shell">
    <div
      v-if="activeModelUrl && !loadError"
      ref="stageRef"
      class="model3d-media-shell model3d-obj-shell nodrag nopan"
      @pointerdown.stop.prevent="handleStagePointerDown"
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
      v-if="showInteractiveControls"
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
      v-if="showInteractiveControls"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { AddOutline, AppsOutline, RemoveOutline } from '../../icons/coolicons'
import { createAuthenticatedMediaProxyUrl } from '@/utils/media'

const props = defineProps({
  url: { type: String, default: '' },
  assetUrls: { type: Object, default: () => ({}) },
  previewImageUrl: { type: String, default: '' },
  alt: { type: String, default: '3D preview' },
  emptyLabel: { type: String, default: 'Run the 3D config node to preview the model here' },
  showControls: { type: Boolean, default: true }
})

const stageRef = ref(null)
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
  if (/\.glb($|\?)/i.test(directUrl)) return createAuthenticatedMediaProxyUrl(directUrl)
  return createAuthenticatedMediaProxyUrl(String(props.assetUrls?.glb || '').trim())
})
const objUrl = computed(() => {
  const directUrl = String(props.url || '').trim()
  if (/\.obj($|\?)/i.test(directUrl)) return createAuthenticatedMediaProxyUrl(directUrl)
  return createAuthenticatedMediaProxyUrl(String(props.assetUrls?.obj || '').trim())
})
const preferObjFallback = ref(false)
const activeModelType = computed(() => {
  if (!preferObjFallback.value && viewerUrl.value) return 'glb'
  if (objUrl.value) return 'obj'
  if (viewerUrl.value) return 'glb'
  return ''
})
const activeModelUrl = computed(() => {
  if (activeModelType.value === 'glb') return viewerUrl.value
  if (activeModelType.value === 'obj') return objUrl.value
  return ''
})
const showInteractiveControls = computed(() => props.showControls && !!activeModelUrl.value && !loadError.value)

const orbitAngle = ref(0)
const elevationAngle = ref(72)
const zoomPercent = ref(100)
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

let sceneRenderer = null
let sceneRoot = null
let sceneCamera = null
let sceneAnimationFrame = 0
let sceneLoadToken = 0
let sceneTargetY = 0
let sceneBaseDistance = 4
let stageDragPointerId = null
let stageDragStartX = 0
let stageDragStartY = 0
let stageStartOrbit = 0
let stageStartElevation = 72

const syncCubeToCamera = () => {
  cubeRotationY.value = orbitAngle.value - 30
  cubeRotationX.value = Math.max(-88, Math.min(88, 68 - elevationAngle.value))
}

const syncSceneCamera = () => {
  if (!sceneCamera) return
  const radius = sceneBaseDistance * (zoomPercent.value / 100)
  const radians = (orbitAngle.value * Math.PI) / 180
  const verticalRadians = (elevationAngle.value * Math.PI) / 180
  const y = Math.cos(verticalRadians) * radius
  const planar = Math.sin(verticalRadians) * radius
  sceneCamera.position.set(Math.sin(radians) * planar, y, Math.cos(radians) * planar)
  sceneCamera.lookAt(0, sceneTargetY, 0)
  sceneCamera.updateProjectionMatrix()
  sceneRenderer?.render(sceneRoot, sceneCamera)
}

const resetView = () => {
  orbitAngle.value = 0
  elevationAngle.value = 72
  zoomPercent.value = 100
  syncCubeToCamera()
}

const syncCameraToCube = () => {
  orbitAngle.value = cubeRotationY.value + 30
  elevationAngle.value = Math.max(8, Math.min(160, 68 - cubeRotationX.value))
  syncSceneCamera()
}

const stopSceneLoop = () => {
  if (sceneAnimationFrame) {
    cancelAnimationFrame(sceneAnimationFrame)
    sceneAnimationFrame = 0
  }
}

const renderScene = () => {
  if (!sceneRenderer || !sceneRoot || !sceneCamera) return
  sceneAnimationFrame = requestAnimationFrame(renderScene)
  sceneRenderer.render(sceneRoot, sceneCamera)
}

const disposeThreeAsset = (object) => {
  object?.traverse?.((child) => {
    if (child?.geometry?.dispose) {
      child.geometry.dispose()
    }
    const materials = Array.isArray(child?.material) ? child.material : [child?.material]
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture && value.dispose) value.dispose()
      })
      if (material.dispose) material.dispose()
    })
  })
}

const disposeSceneViewer = () => {
  sceneLoadToken += 1
  stopSceneLoop()
  if (sceneRoot) {
    disposeThreeAsset(sceneRoot)
    sceneRoot = null
  }
  if (sceneRenderer) {
    sceneRenderer.dispose()
    sceneRenderer.domElement?.remove()
    sceneRenderer = null
  }
  sceneCamera = null
  sceneTargetY = 0
  sceneBaseDistance = 4
}

const loadStageObject = (type, url) =>
  new Promise((resolve, reject) => {
    if (type === 'glb') {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf?.scene || gltf?.scenes?.[0] || null),
        undefined,
        reject
      )
      return
    }

    new OBJLoader().load(url, resolve, undefined, reject)
  })

const computeBoundsFromPositionAttribute = (mesh) => {
  const positionAttribute = mesh?.geometry?.attributes?.position
  if (!positionAttribute || typeof positionAttribute.count !== 'number' || positionAttribute.count <= 0) {
    return null
  }

  const worldBox = new THREE.Box3()
  const point = new THREE.Vector3()
  let hasPoint = false
  const sampleLimit = 4096
  const sampleStep = Math.max(1, Math.floor(positionAttribute.count / sampleLimit))
  const sampledX = []
  const sampledY = []
  const sampledZ = []

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const x = positionAttribute.getX(index)
    const y = positionAttribute.getY(index)
    const z = positionAttribute.getZ(index)

    if (![x, y, z].every((value) => Number.isFinite(value))) continue

    point.set(x, y, z).applyMatrix4(mesh.matrixWorld)
    if (![point.x, point.y, point.z].every((value) => Number.isFinite(value))) continue

    if (!hasPoint) {
      worldBox.min.copy(point)
      worldBox.max.copy(point)
      hasPoint = true
    } else {
      worldBox.expandByPoint(point)
    }

    if (index % sampleStep === 0) {
      sampledX.push(point.x)
      sampledY.push(point.y)
      sampledZ.push(point.z)
    }
  }

  if (!hasPoint || worldBox.isEmpty()) return null

  if (sampledX.length < 64) {
    return worldBox
  }

  sampledX.sort((a, b) => a - b)
  sampledY.sort((a, b) => a - b)
  sampledZ.sort((a, b) => a - b)

  const lowerIndex = Math.max(0, Math.floor(sampledX.length * 0.02))
  const upperIndex = Math.min(sampledX.length - 1, Math.ceil(sampledX.length * 0.98) - 1)
  const trimmedMin = new THREE.Vector3(
    sampledX[lowerIndex],
    sampledY[lowerIndex],
    sampledZ[lowerIndex]
  )
  const trimmedMax = new THREE.Vector3(
    sampledX[upperIndex],
    sampledY[upperIndex],
    sampledZ[upperIndex]
  )
  const trimmedBox = new THREE.Box3(trimmedMin, trimmedMax)

  if (trimmedBox.isEmpty()) {
    return worldBox
  }

  const rawSize = worldBox.getSize(new THREE.Vector3())
  const trimmedSize = trimmedBox.getSize(new THREE.Vector3())
  const rawMaxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0)
  const trimmedMaxDim = Math.max(trimmedSize.x, trimmedSize.y, trimmedSize.z, 0)

  if (!Number.isFinite(rawMaxDim) || !Number.isFinite(trimmedMaxDim) || trimmedMaxDim <= 0) {
    return worldBox
  }

  return rawMaxDim > trimmedMaxDim * 25 ? trimmedBox : worldBox
}

const prepareRenderableObject = (object, type) => {
  object?.traverse?.((child) => {
    if (!child?.isMesh) return

    // Some provider-generated GLBs contain invalid bounds metadata.
    // Disabling frustum culling keeps them renderable even when Three.js
    // would otherwise cull the mesh before the first visible frame.
    child.frustumCulled = false

    if (type === 'obj') {
      child.material = new THREE.MeshStandardMaterial({
        color: '#d7dbe3',
        metalness: 0.28,
        roughness: 0.58
      })
    }
  })
}

const computeRenderableBounds = (object) => {
  if (!object) return null

  object.updateMatrixWorld(true)
  const meshBounds = new THREE.Box3()
  let hasMeshBounds = false

  object.traverse((child) => {
    if (!child?.isMesh || !child.geometry) return

    const geometry = child.geometry
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox()
    }

    const localBox = geometry.boundingBox
    let worldBox = null

    if (localBox && !localBox.isEmpty()) {
      const candidate = localBox.clone().applyMatrix4(child.matrixWorld)
      const values = [
        candidate.min.x,
        candidate.min.y,
        candidate.min.z,
        candidate.max.x,
        candidate.max.y,
        candidate.max.z
      ]

      if (values.every((value) => Number.isFinite(value))) {
        worldBox = candidate
      }
    }

    if (!worldBox) {
      worldBox = computeBoundsFromPositionAttribute(child)
    }

    if (!worldBox) return

    if (!hasMeshBounds) {
      meshBounds.copy(worldBox)
      hasMeshBounds = true
      return
    }

    meshBounds.union(worldBox)
  })

  if (hasMeshBounds && !meshBounds.isEmpty()) {
    return meshBounds
  }

  const fallbackBox = new THREE.Box3().setFromObject(object)
  const fallbackValues = [
    fallbackBox.min.x,
    fallbackBox.min.y,
    fallbackBox.min.z,
    fallbackBox.max.x,
    fallbackBox.max.y,
    fallbackBox.max.z
  ]

  if (fallbackBox.isEmpty() || !fallbackValues.every((value) => Number.isFinite(value))) {
    return null
  }

  return fallbackBox
}

const mountSceneViewer = async () => {
  if (!activeModelUrl.value || !stageRef.value) return

  disposeSceneViewer()
  await nextTick()
  loadError.value = ''

  const host = stageRef.value
  const width = Math.max(1, host.clientWidth)
  const height = Math.max(1, host.clientHeight)
  const loadToken = sceneLoadToken + 1
  sceneLoadToken = loadToken

  sceneRoot = new THREE.Scene()
  sceneRoot.background = new THREE.Color('#0f0f0f')

  sceneCamera = new THREE.PerspectiveCamera(42, width / height, 0.1, 5000)
  sceneRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  sceneRenderer.setPixelRatio(window.devicePixelRatio || 1)
  sceneRenderer.setSize(width, height)
  sceneRenderer.outputColorSpace = THREE.SRGBColorSpace
  sceneRenderer.toneMapping = THREE.ACESFilmicToneMapping
  sceneRenderer.toneMappingExposure = 1
  host.innerHTML = ''
  host.appendChild(sceneRenderer.domElement)

  sceneRoot.add(new THREE.AmbientLight(0xffffff, 1.8))
  sceneRoot.add(new THREE.HemisphereLight(0xf4f5f7, 0x1d2128, 1.2))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
  keyLight.position.set(4, 6, 5)
  sceneRoot.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xe8edf6, 1.1)
  fillLight.position.set(-5, 3, 4)
  sceneRoot.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xf1f3f6, 0.65)
  rimLight.position.set(-5, 2, -4)
  sceneRoot.add(rimLight)

  try {
    const nextObject = await loadStageObject(activeModelType.value, activeModelUrl.value)
    if (loadToken !== sceneLoadToken || !sceneRoot || !sceneCamera) return
    if (!nextObject) {
      throw new Error('No 3D scene returned by loader')
    }

    prepareRenderableObject(nextObject, activeModelType.value)

    nextObject.updateMatrixWorld(true)
    sceneRoot.add(nextObject)
    const box = computeRenderableBounds(nextObject)

    if (box) {
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      nextObject.position.sub(center)

      const maxDim = Math.max(size.x, size.y, size.z, 1)
      sceneBaseDistance = maxDim * 1.55
      sceneTargetY = 0
      sceneCamera.near = Math.max(0.01, maxDim / 200)
      sceneCamera.far = Math.max(1000, maxDim * 24)
    } else {
      console.warn('3D preview bounds fallback engaged', {
        type: activeModelType.value,
        url: activeModelUrl.value
      })
      sceneBaseDistance = 4
      sceneTargetY = 0
      sceneCamera.near = 0.01
      sceneCamera.far = 5000
    }

    resetView()
    syncSceneCamera()
    renderScene()
  } catch (error) {
    if (loadToken !== sceneLoadToken) return
    if (activeModelType.value === 'glb' && objUrl.value && !preferObjFallback.value) {
      preferObjFallback.value = true
      loadError.value = ''
      console.warn('GLB preview failed, falling back to OBJ preview', error)
      return
    }
    loadError.value = error?.message || `${String(activeModelType.value || '3D').toUpperCase()} preview failed to load`
    console.error('3D preview load failed', {
      type: activeModelType.value,
      url: activeModelUrl.value,
      error
    })
  }
}

const setViewPreset = (viewKey) => {
  const preset = VIEW_PRESETS[viewKey]
  if (!preset) return
  orbitAngle.value = preset.azimuth
  elevationAngle.value = preset.elevation
  syncCubeToCamera()
  syncSceneCamera()
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

const handleStagePointerMove = (event) => {
  if (stageDragPointerId == null || event.pointerId !== stageDragPointerId) return
  const dx = event.clientX - stageDragStartX
  const dy = event.clientY - stageDragStartY
  orbitAngle.value = stageStartOrbit + dx * 0.45
  elevationAngle.value = Math.max(8, Math.min(160, stageStartElevation - dy * 0.3))
  syncCubeToCamera()
  syncSceneCamera()
}

const handleStagePointerUp = (event) => {
  if (stageDragPointerId == null || event.pointerId !== stageDragPointerId) return
  stageDragPointerId = null
  window.removeEventListener('pointermove', handleStagePointerMove)
  window.removeEventListener('pointerup', handleStagePointerUp)
}

const handleStagePointerDown = (event) => {
  if (!activeModelUrl.value) return
  stageDragPointerId = event.pointerId
  stageDragStartX = event.clientX
  stageDragStartY = event.clientY
  stageStartOrbit = orbitAngle.value
  stageStartElevation = elevationAngle.value
  window.addEventListener('pointermove', handleStagePointerMove)
  window.addEventListener('pointerup', handleStagePointerUp)
}

const zoomIn = () => {
  zoomPercent.value = Math.max(55, zoomPercent.value - 10)
  syncSceneCamera()
}

const zoomOut = () => {
  zoomPercent.value = Math.min(180, zoomPercent.value + 10)
  syncSceneCamera()
}

watch(activeModelUrl, async (nextUrl) => {
  loadError.value = ''
  if (nextUrl) {
    await mountSceneViewer()
    return
  }
  disposeSceneViewer()
}, { immediate: true })

watch(activeModelType, async () => {
  loadError.value = ''
  if (!activeModelUrl.value) return
  await mountSceneViewer()
})

watch([viewerUrl, objUrl], () => {
  preferObjFallback.value = false
  loadError.value = ''
})

onMounted(async () => {
  syncCubeToCamera()
  if (!activeModelUrl.value) return
  await mountSceneViewer()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleCubePointerMove)
  window.removeEventListener('pointerup', handleCubePointerUp)
  window.removeEventListener('pointermove', handleStagePointerMove)
  window.removeEventListener('pointerup', handleStagePointerUp)
  disposeSceneViewer()
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
