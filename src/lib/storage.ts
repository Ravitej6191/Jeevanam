import { supabase } from './supabase'

const BUCKET = 'tenant-uploads'

/**
 * Uploads a tenant-related file (photo, deposit screenshot) and returns a
 * URL to store on the record, uploading it to Supabase Storage instead of
 * writing large base64 blobs into `select('*')` rows.
 */
export async function uploadTenantFile(file: File, folder: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
