import { asyncHandler, sendJson } from '../utils/http.js'
import {
  createChatCompletion,
  createImageGeneration,
  createVideoGeneration,
  getVideoTask
} from '../services/runs.service.js'
import { providerRemoveBackground } from '../services/provider.service.js'

const createRunResultHandler = (createRunFn) => asyncHandler(async (req, res) => {
  const run = await createRunFn(req.user.id, req.body)
  sendJson(res, run.result)
})

export const handleCompatChatCompletions = createRunResultHandler(createChatCompletion)

export const handleCompatImageGenerations = createRunResultHandler(createImageGeneration)

export const handleCompatRemoveBackground = asyncHandler(async (req, res) => {
  const result = await providerRemoveBackground(req.body || {})
  sendJson(res, result)
})

export const handleCompatVideos = createRunResultHandler(createVideoGeneration)

export const handleCompatVideoTask = asyncHandler(async (req, res) => {
  const result = await getVideoTask(req.user.id, req.params.taskId)
  sendJson(res, result)
})
