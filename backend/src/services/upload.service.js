import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey)
const BUCKET_NAME = 'uploads'

export const uploadFile = async (file) => {
  const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    })

  if (error) {
    console.error('Supabase upload error:', error)
    throw new HttpError(500, 'File upload failed', 'UPLOAD_ERROR')
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return { url: publicUrl }
}
