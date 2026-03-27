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

// Video ratio options | 视频比例选项
export const VIDEO_RATIO_LIST = [
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
        label: 'Google Veo 3.1',
        key: 'veo-3.1',
        ratios: ['16:9', '9:16'],
        resolutions: [
            { label: '720p', key: '720p' },
            { label: '1080p', key: '1080p' }
        ],
        durs: [{ label: '4 秒', key: 4 }, { label: '6 秒', key: 6 }, { label: '8 秒', key: 8 }],
        defaultParams: { ratio: '16:9', duration: 8, resolution: '1080p', generate_audio: false }
    }
]

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
export const DEFAULT_IMAGE_SIZE = '1024x1024'
export const DEFAULT_VIDEO_RATIO = '16:9'
export const DEFAULT_VIDEO_DURATION = 8
export const hasVideoModel = (key) => VIDEO_MODELS.some((model) => model.key === key)
export const resolveVideoModelKey = (key) => (hasVideoModel(key) ? key : DEFAULT_VIDEO_MODEL)

// Get model by key | 根据 key 获取模型
export const getModelByName = (key) => {
    const allModels = [...IMAGE_MODELS, ...VIDEO_MODELS, ...CHAT_MODELS]
    return allModels.find(m => m.key === key)
}
