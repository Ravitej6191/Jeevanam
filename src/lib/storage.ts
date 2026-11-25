import { supabase } from './supabase'

const BUCKET = 'tenant-uploads'
const REMOVE_BATCH = 100

/** Every file path under a folder, walking into sub-folders. */
async function listFilePaths(folder: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000, offset })
    if (error) throw error
    for (const entry of data) {
      // Folders come back without an id; files have one.
      if (entry.id) paths.push(`${folder}/${entry.name}`)
      else paths.push(...(await listFilePaths(`${folder}/${entry.name}`)))
    }
    if (data.length < 1000) return paths
  }
}

/**
 * Removes every file the signed-in owner has uploaded (tenant photos, receipts).
 * Done through the Storage API because Supabase blocks deleting storage rows
 * with SQL, so the database functions can't do it.
 */
export async function deleteAllUploadedFiles(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const paths = await listFilePaths(user.id)
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + REMOVE_BATCH))
    if (error) throw error
  }
}

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
