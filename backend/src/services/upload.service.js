import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey)
const BUCKET_NAME = 'uploads'
let bucketReady = false

const ensureBucket = async () => {
  if (bucketReady) return

  const { data: bucket, error: getErr } = await supabase.storage.getBucket(BUCKET_NAME)
  if (!getErr && bucket) {
    bucketReady = true
    return
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: '50MB'
  })

  if (createErr && !/already exists/i.test(createErr.message || '')) {
    throw createErr
  }
  bucketReady = true
}

const uploadToBucket = async (fileName, file) => {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    })
  return error
}

export const uploadFile = async (file) => {
  const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`

  try {
    await ensureBucket()
  } catch (error) {
    console.error('Supabase bucket check/create error:', error)
    throw new HttpError(500, 'File upload failed', 'UPLOAD_ERROR')
  }

  let error = await uploadToBucket(fileName, file)
  if (error && /bucket/i.test(error.message || '')) {
    // Heal missing bucket once, then retry upload.
    try {
      bucketReady = false
      await ensureBucket()
      error = await uploadToBucket(fileName, file)
    } catch (retryErr) {
      error = retryErr
    }
  }

  if (error) {
    console.error('Supabase upload error:', error)
    throw new HttpError(500, 'File upload failed', 'UPLOAD_ERROR')
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return { url: publicUrl }
}
