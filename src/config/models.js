/**
 * Models Configuration | 模型配置
 * Centralized model configuration | 集中模型配置
 */

// Seedream image size options | 豆包图片尺寸选项
export const SEEDREAM_SIZE_OPTIONS = [
    { label: '21:9 (3024x1296)', key: '3024x1296' },
    { label: '16:9 (2560x1440)', key: '2560x1440' },
    { label: '4:3 (2304x1728)', key: '2304x1728' },
    { label: '3:2 (2496x1664)', key: '2496x1664' },
    { label: '1:1 (2048x2048)', key: '2048x2048' },
    { label: '2:3 (1664x2496)', key: '1664x2496' },
    { label: '3:4 (1728x2304)', key: '1728x2304' },
    { label: '9:16 (1440x2560)', key: '1440x2560' },
    { label: '9:21 (1296x3024)', key: '1296x3024' }
]

// Image generation models | 图片生成模型
export const IMAGE_MODELS = [
    {
        label: '豆包 Seedream 4.5 (免费)',
        key: 'free/doubao-seedream-4.5',
        sizes: SEEDREAM_SIZE_OPTIONS.map(s => s.key),
        defaultParams: {
            size: '2048x2048',
            quality: 'standard',
            style: 'vivid'
        }
    },
    {
        label: '豆包 Seedream 4.5',
        key: 'doubao-seedream-4-5-251128',
        sizes: SEEDREAM_SIZE_OPTIONS.map(s => s.key),
        defaultParams: {
            size: '2048x2048',
            quality: 'standard',
            style: 'vivid'
        }
    },
    {
        label: 'Nano Banana Pro',
        key: 'nano-banana-pro',
        tips: '尺寸写在提示词中: 尺寸 9:16',
        sizes: [],
        defaultParams: {
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
        label: '豆包视频 480P (免费)',
        key: 'free/doubao-seedance-1-5-pro_480p',
        ratios: VIDEO_RATIO_LIST.map(s => s.key),
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5 }
    },
    {
        label: '豆包视频 720P',
        key: 'doubao-seedance-1-5-pro_720p',
        ratios: VIDEO_RATIO_LIST.map(s => s.key),
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5 }
    },
    {
        label: 'Wan 2.6 720P', key: 'wan2.6_720p',
        ratios: VIDEO_RATIO_LIST.map(s => s.key),
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5 }
    },
    {
        label: 'Sora 2', key: 'sora-2',
        ratios: VIDEO_RATIO_LIST.map(s => s.key),
        durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
        defaultParams: { ratio: '16:9', duration: 5 }
    }
]

// Chat/LLM models | 对话模型
export const CHAT_MODELS = [
    { label: 'GPT-4o Mini', key: 'gpt-4o-mini' },
    { label: 'GPT-4o', key: 'gpt-4o' },
    { label: 'GPT-5.2', key: 'gpt-5.2' },
    { label: 'DeepSeek Chat', key: 'deepseek-chat' },
    { label: '豆包 Seed Flash', key: 'doubao-seed-1-6-flash-250615' },
    { label: 'Gemini 3 Pro', key: 'gemini-3-pro' }
]

// Image size options | 图片尺寸选项
export const IMAGE_SIZE_OPTIONS = [
    { label: '1024x1024', key: '1024x1024' },
    { label: '1792x1024 (横版)', key: '1792x1024' },
    { label: '1024x1792 (竖版)', key: '1024x1792' }
]

// Image quality options | 图片质量选项
export const IMAGE_QUALITY_OPTIONS = [
    { label: '标准', key: 'standard' },
    { label: '高清', key: 'hd' }
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
export const DEFAULT_IMAGE_MODEL = 'free/doubao-seedream-4.5'
export const DEFAULT_VIDEO_MODEL = 'free/doubao-seedance-1-5-pro_480p'
export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini'
export const DEFAULT_IMAGE_SIZE = '1024x1024'
export const DEFAULT_VIDEO_RATIO = '16:9'
export const DEFAULT_VIDEO_DURATION = 5

// Get model by key | 根据 key 获取模型
export const getModelByName = (key) => {
    const allModels = [...IMAGE_MODELS, ...VIDEO_MODELS, ...CHAT_MODELS]
    return allModels.find(m => m.key === key)
}
