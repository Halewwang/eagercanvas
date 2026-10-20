/**
 * Models Configuration | 模型配置
 * Centralized model configuration | 集中模型配置
 */

import { GPT_IMAGE_2_RATIOS, GPT_IMAGE_2_RESOLUTION_OPTIONS } from '@/utils/gptImageParameters'

const GPT_IMAGE_2_MODEL_CONFIG = {
    label: 'GPT Image 2',
    key: 'gpt-image-2',
    sizes: GPT_IMAGE_2_RATIOS,
    ratios: GPT_IMAGE_2_RATIOS,
    resolutions: GPT_IMAGE_2_RESOLUTION_OPTIONS,
    hideRatioCapsule: false,
    defaultParams: {
        ratio: '1:1',
        resolution: '1k',
        size: '1:1'
    },
    supportImageReference: true,
    maxReferenceImages: 15,
    requestTimeoutMs: 1800000,
    tips: '按比例与分辨率生成图片，最多 15 张参考图。'
}

// Image generation models | 图片生成模型
export const IMAGE_MODELS = [GPT_IMAGE_2_MODEL_CONFIG]

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
    { label: 'GPT 5.6 Sol', key: 'gpt-5.6-sol' }
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
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2'
export const DEFAULT_VIDEO_MODEL = 'veo-3.1'
export const DEFAULT_CHAT_MODEL = 'gpt-5.6-sol'
export const DEFAULT_IMAGE_SIZE = '1024x1024'
export const DEFAULT_VIDEO_RATIO = '16:9'
export const DEFAULT_VIDEO_DURATION = 8
export const resolveImageModelKey = (key) => IMAGE_MODELS.some((model) => model.key === key) ? key : DEFAULT_IMAGE_MODEL
export const resolveChatModelKey = (key) => CHAT_MODELS.some((model) => model.key === key) ? key : DEFAULT_CHAT_MODEL
export const hasVideoModel = (key) => VIDEO_MODELS.some((model) => model.key === key)
export const resolveVideoModelKey = (key) => (hasVideoModel(key) ? key : DEFAULT_VIDEO_MODEL)

// Get model by key | 根据 key 获取模型
export const getModelByName = (key) => {
    const allModels = [...IMAGE_MODELS, ...VIDEO_MODELS, ...CHAT_MODELS]
    return allModels.find(m => m.key === key)
}
