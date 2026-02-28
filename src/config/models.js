/**
 * Models Configuration | 模型配置
 * Centralized model configuration | 集中模型配置
 */

const GEMINI_BASE_SIZES = [
    { ratio: '1:1', width: 1024, height: 1024 },
    { ratio: '4:3', width: 1152, height: 864 },
    { ratio: '3:4', width: 864, height: 1152 },
    { ratio: '16:9', width: 1280, height: 720 },
    { ratio: '9:16', width: 720, height: 1280 }
]

const GEMINI_RESOLUTION_LEVELS = [
    { key: '1k', scale: 1 },
    { key: '2k', scale: 2 },
    { key: '4k', scale: 4 }
]

const SORA2_SIZE_OPTIONS = [
    { label: '720x1280', key: '720x1280', ratio: '9:16' },
    { label: '1280x720', key: '1280x720', ratio: '16:9' },
    { label: '1024x1792', key: '1024x1792', ratio: '4:7' },
    { label: '1792x1024', key: '1792x1024', ratio: '7:4' }
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
        }
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
        }
    }
]

// Video ratio options | 视频比例选项
export const VIDEO_RATIO_LIST = [
    { label: '16:9 (横版)', key: '16:9' },
    { label: '4:3', key: '4:3' },
    { label: '1:1 (方形)', key: '1:1' },
    { label: '3:4', key: '3:4' },
    { label: '9:16 (竖版)', key: '9:16' }
]

// Video generation models | 视频生成模型
export const VIDEO_MODELS = [
    {
        label: 'Kling O1',
        key: 'kling-o1',
        ratios: VIDEO_RATIO_LIST.map(s => s.key),
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5 }
    },
    {
        label: 'Sora-2',
        key: 'sora-2',
        ratios: [...new Set(SORA2_SIZE_OPTIONS.map((s) => s.ratio))],
        sizes: SORA2_SIZE_OPTIONS,
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5, size: '1280x720' }
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
export const DEFAULT_VIDEO_MODEL = 'kling-o1'
export const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash'
export const DEFAULT_IMAGE_SIZE = '1024x1024'
export const DEFAULT_VIDEO_RATIO = '16:9'
export const DEFAULT_VIDEO_DURATION = 5

// Get model by key | 根据 key 获取模型
export const getModelByName = (key) => {
    const allModels = [...IMAGE_MODELS, ...VIDEO_MODELS, ...CHAT_MODELS]
    return allModels.find(m => m.key === key)
}
