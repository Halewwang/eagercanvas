/**
 * Models Configuration | 模型配置
 * Centralized model configuration | 集中模型配置
 */

const GEMINI_BASE_SIZES = [
    { ratio: '1:1', width: 1024, height: 1024 },
    { ratio: '3:2', width: 1152, height: 768 },
    { ratio: '2:3', width: 768, height: 1152 },
    { ratio: '4:3', width: 1152, height: 864 },
    { ratio: '3:4', width: 864, height: 1152 },
    { ratio: '4:5', width: 896, height: 1120 },
    { ratio: '5:4', width: 1120, height: 896 },
    { ratio: '16:9', width: 1280, height: 720 },
    { ratio: '9:16', width: 720, height: 1280 },
    { ratio: '21:9', width: 1680, height: 720 }
]

const GEMINI_RESOLUTION_LEVELS = [
    { key: '1k', scale: 1 },
    { key: '2k', scale: 2 },
    { key: '4k', scale: 4 }
]

// Gemini image size options | Gemini 图片尺寸选项
export const GEMINI_IMAGE_SIZE_OPTIONS = GEMINI_BASE_SIZES.flatMap((base) =>
    GEMINI_RESOLUTION_LEVELS.map((level) => ({
        label: `${base.ratio}`,
        key: `${base.width * level.scale}x${base.height * level.scale}`
    }))
)

export const GEMINI_IMAGE_QUALITY_OPTIONS = [
    { label: '标准', key: 'standard' },
    { label: '高清', key: 'hd' }
]

// Image generation models | 图片生成模型
export const IMAGE_MODELS = [
    {
        label: 'Gemini 3.1 Flash Image Preview',
        key: 'gemini-3.1-flash-image-preview',
        sizes: GEMINI_IMAGE_SIZE_OPTIONS.map(s => s.key),
        qualities: GEMINI_IMAGE_QUALITY_OPTIONS,
        defaultParams: {
            size: '1024x1024',
            quality: 'standard',
            style: 'vivid'
        },
        supportImageReference: true,
        tips: '使用 302 ws 同步图片路由，支持 1K/2K/4K 分辨率枚举参数。'
    },
    {
        label: 'Gemini 3 Pro Image Preview',
        key: 'gemini-3-pro-image-preview',
        sizes: GEMINI_IMAGE_SIZE_OPTIONS.map(s => s.key),
        qualities: GEMINI_IMAGE_QUALITY_OPTIONS,
        defaultParams: {
            size: '1024x1024',
            quality: 'standard',
            style: 'vivid'
        },
        supportImageReference: true,
        tips: '使用 302 ws 同步图片路由，支持 1K/2K/4K 分辨率枚举参数。'
    }
]

// 3D generation models | 3D生成模型
export const MODEL3D_MODELS = [
    {
        label: 'Hunyuan 3D Pro 3.1',
        key: 'hunyuan3d-pro-3.1',
        viewTypes: ['front', 'left', 'right', 'back', 'top', 'bottom', 'left_front', 'right_front'],
        generateTypes: ['Normal', 'Geometry', 'Sketch'],
        faceCounts: [
            { label: '1.5m', key: '1500000' },
            { label: '1m', key: '1000000' },
            { label: '500k', key: '500000' }
        ],
        resultFormats: [
            { label: 'GLB', key: 'GLB' }
        ],
        defaultParams: {
            prompt: '',
            allowTextOnly: true,
            generateType: 'Normal',
            enablePBR: false,
            faceCount: '500000',
            resultFormat: 'GLB',
            polygonType: ''
        },
        tips: '支持多视角图像输入，每个视角仅允许 1 张图片。'
    },
    {
        label: 'Hunyuan 3D Pro 3.0',
        key: 'hunyuan3d-pro-3.0',
        viewTypes: ['front', 'left', 'right', 'back'],
        generateTypes: ['Normal', 'LowPoly', 'Geometry', 'Sketch'],
        faceCounts: [
            { label: '1.5m', key: '1500000' },
            { label: '1m', key: '1000000' },
            { label: '500k', key: '500000' }
        ],
        polygonTypes: [
            { label: 'Triangle', key: 'triangle' },
            { label: 'Quadrilateral', key: 'quadrilateral' }
        ],
        resultFormats: [
            { label: 'GLB', key: 'GLB' }
        ],
        defaultParams: {
            prompt: '',
            allowTextOnly: true,
            generateType: 'Normal',
            enablePBR: false,
            faceCount: '500000',
            resultFormat: 'GLB',
            polygonType: 'triangle'
        },
        tips: '需要主图 front，附加视角仅支持 left / right / back。'
    }
]

// Video ratio options | 视频比例选项
export const VIDEO_RATIO_LIST = [
    { label: '21:9 (电影宽屏)', key: '21:9' },
    { label: '16:9 (横版)', key: '16:9' },
    { label: '7:4 (横版)', key: '7:4' },
    { label: '4:3', key: '4:3' },
    { label: '1:1 (方形)', key: '1:1' },
    { label: '3:4', key: '3:4' },
    { label: '4:7 (竖版)', key: '4:7' },
    { label: '9:16 (竖版)', key: '9:16' }
]

// Video generation models | 视频生成模型
export const VIDEO_MODELS = [
    {
        label: 'Kling O1',
        key: 'kling-o1',
        ratios: ['16:9', '9:16', '1:1'],
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5 }
    },
    {
        label: 'Kling O3',
        key: 'kling-o3',
        ratios: ['16:9', '1:1', '9:16'],
        modes: [
            { label: '720p', key: 'std' },
            { label: '1080p', key: 'pro' }
        ],
        generationTypes: [
            { label: 'Image Reference', key: 'referImage' },
            { label: 'First + Last Frame', key: 'firstTail' }
        ],
        durs: [{ label: '3 秒', key: 3 }, { label: '5 秒', key: 5 }, { label: '8 秒', key: 8 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5, mode: 'pro', o1_type: 'referImage', enable_audio: false },
        supportAudioToggle: true
    },
    {
        label: 'Google Veo 3.1',
        key: 'veo-3.1',
        ratios: ['16:9', '9:16'],
        resolutions: [
            { label: '720p', key: '720p' },
            { label: '1080p', key: '1080p' }
        ],
        durs: [{ label: '4 秒', key: 4 }, { label: '6 秒', key: 6 }, { label: '8 秒', key: 8 }],
        defaultParams: { ratio: '16:9', duration: 8, resolution: '1080p', generate_audio: false },
        supportAudioToggle: true
    },
    {
        label: 'Seedance 2.0',
        key: 'seedance-2.0',
        ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: [
            { label: '480p', key: '480p' },
            { label: '720p', key: '720p' }
        ],
        generationTypes: [
            { label: 'Text to Video', key: 'text_to_video' },
            { label: 'First + Last Frame', key: 'first_last_frames' },
            { label: 'Omni Reference', key: 'omni_reference' }
        ],
        durs: [
            { label: '4 秒', key: 4 },
            { label: '5 秒', key: 5 },
            { label: '6 秒', key: 6 },
            { label: '8 秒', key: 8 },
            { label: '10 秒', key: 10 },
            { label: '12 秒', key: 12 },
            { label: '15 秒', key: 15 }
        ],
        defaultParams: {
            ratio: '16:9',
            duration: 5,
            resolution: '720p',
            o1_type: 'text_to_video',
            generate_audio: true
        },
        supportAudioToggle: true,
        supportVideoReference: true
    }
]

const DEFAULT_VIDEO_INPUT_PROFILE = {
    allowPrompt: true,
    allowFirstFrame: true,
    allowLastFrame: true,
    allowImageReference: true,
    allowVideoReference: false,
    allowRatio: true,
    allowSize: false,
    allowResolution: false,
    allowMode: false,
    allowType: false,
    allowAudioToggle: false,
    allowDuration: true
}

const SEEDANCE_CONNECTION_PROFILE = {
    ...DEFAULT_VIDEO_INPUT_PROFILE,
    allowFirstFrame: true,
    allowLastFrame: true,
    allowImageReference: true,
    allowVideoReference: true,
    allowResolution: true,
    allowType: false,
    allowAudioToggle: true
}

const SEEDANCE_INPUT_PROFILES = {
    text_to_video: {
        allowFirstFrame: false,
        allowLastFrame: false,
        allowImageReference: false,
        allowVideoReference: false,
        allowResolution: true,
        allowType: false,
        allowAudioToggle: true
    },
    first_last_frames: {
        allowFirstFrame: true,
        allowLastFrame: true,
        allowImageReference: false,
        allowVideoReference: false,
        allowRatio: false,
        allowResolution: true,
        allowType: false,
        allowAudioToggle: true
    },
    omni_reference: {
        allowFirstFrame: false,
        allowLastFrame: false,
        allowImageReference: true,
        allowVideoReference: true,
        allowResolution: true,
        allowType: false,
        allowAudioToggle: true
    }
}

export const resolveSeedanceGenerationType = ({
    firstFrameImage = '',
    lastFrameImage = '',
    referenceImages = [],
    referenceVideos = []
} = {}) => {
    if (String(firstFrameImage || '').trim() && String(lastFrameImage || '').trim()) {
        return 'first_last_frames'
    }

    if ((Array.isArray(referenceImages) && referenceImages.length > 0) || (Array.isArray(referenceVideos) && referenceVideos.length > 0)) {
        return 'omni_reference'
    }

    return 'text_to_video'
}

export const getVideoGenerationProfile = (modelKey = '', generationType = '') => {
    const model = VIDEO_MODELS.find((item) => item.key === modelKey)
    const profile = {
        ...DEFAULT_VIDEO_INPUT_PROFILE,
        allowSize: Array.isArray(model?.sizes) && model.sizes.length > 0,
        allowResolution: Array.isArray(model?.resolutions) && model.resolutions.length > 0,
        allowMode: Array.isArray(model?.modes) && model.modes.length > 0,
        allowType: Array.isArray(model?.generationTypes) && model.generationTypes.length > 0,
        allowAudioToggle: Boolean(model?.supportAudioToggle),
        allowVideoReference: Boolean(model?.supportVideoReference)
    }

    if (modelKey !== 'seedance-2.0') return profile

    const safeType = String(generationType || model?.defaultParams?.o1_type || 'text_to_video').trim()
    return {
        ...profile,
        ...(SEEDANCE_INPUT_PROFILES[safeType] || SEEDANCE_INPUT_PROFILES.text_to_video)
    }
}

export const getVideoConnectionProfile = (modelKey = '', generationType = '') => {
    if (modelKey === 'seedance-2.0') {
        return { ...SEEDANCE_CONNECTION_PROFILE }
    }
    return getVideoGenerationProfile(modelKey, generationType)
}

// Chat/LLM models | 对话模型
export const CHAT_MODELS = [
    { label: 'Gemini 2.5 Flash', key: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Flash Lite', key: 'gemini-2.5-flash-lite' }
]

// Image size options | 图片尺寸选项
export const IMAGE_SIZE_OPTIONS = [
    ...GEMINI_IMAGE_SIZE_OPTIONS
]

// Image quality options | 图片质量选项
export const IMAGE_QUALITY_OPTIONS = [
    ...GEMINI_IMAGE_QUALITY_OPTIONS
]

// Image style options | 图片风格选项
export const IMAGE_STYLE_OPTIONS = [
    { label: '生动', key: 'vivid' },
    { label: '自然', key: 'natural' }
]

// Video ratio options | 视频比例选项
export const VIDEO_RATIO_OPTIONS = VIDEO_RATIO_LIST

// Video duration options | 视频时长选项
export const VIDEO_DURATION_OPTIONS = [
    { label: '5 秒', key: 5 },
    { label: '10 秒', key: 10 }
]

// Default values | 默认值
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview'
export const DEFAULT_VIDEO_MODEL = 'veo-3.1'
export const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash'
export const DEFAULT_MODEL3D_MODEL = 'hunyuan3d-pro-3.1'
export const DEFAULT_IMAGE_SIZE = '1024x1024'
export const DEFAULT_VIDEO_RATIO = '16:9'
export const DEFAULT_VIDEO_DURATION = 8
export const hasVideoModel = (key) => VIDEO_MODELS.some((model) => model.key === key)
export const resolveVideoModelKey = (key) => (hasVideoModel(key) ? key : DEFAULT_VIDEO_MODEL)
export const has3DModel = (key) => MODEL3D_MODELS.some((model) => model.key === key)
export const resolve3DModelKey = (key) => (has3DModel(key) ? key : DEFAULT_MODEL3D_MODEL)

// Get model by key | 根据 key 获取模型
export const getModelByName = (key) => {
    const allModels = [...IMAGE_MODELS, ...VIDEO_MODELS, ...CHAT_MODELS, ...MODEL3D_MODELS]
    return allModels.find(m => m.key === key)
}
