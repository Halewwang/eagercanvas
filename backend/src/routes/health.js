export const buildApiHealthPayload = (sourceEnv = process.env) => ({
  ok: true,
  service: 'eagercanvas-api',
  releaseCommit: String(sourceEnv.VERCEL_GIT_COMMIT_SHA || sourceEnv.RELEASE_COMMIT || '').trim(),
  deploymentId: String(sourceEnv.VERCEL_DEPLOYMENT_ID || sourceEnv.BUILD_ID || '').trim(),
  environment: String(sourceEnv.VERCEL_ENV || sourceEnv.NODE_ENV || '').trim()
})
