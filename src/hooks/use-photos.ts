import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadTenantFile } from '@/lib/storage'

/** A photo either already saved (`url` only) or newly picked and waiting to
 * be uploaded on submit (`file` + a local object URL for the preview). */
export interface PhotoItem {
  key: string
  url: string
  file?: File
}

/**
 * State for a multi-photo field. Newly picked files stay local (object URLs)
 * until `resolveUrls` uploads them on submit, so cancelling a form never
 * leaves orphaned uploads behind.
 */
export function usePhotos(folder: string) {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const objectUrls = useRef<Set<string>>(new Set())

  const revokeAll = useCallback(() => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url)
    objectUrls.current.clear()
  }, [])

  useEffect(() => revokeAll, [revokeAll])

  const reset = useCallback(
    (urls: string[] = []) => {
      revokeAll()
      setPhotos(urls.map((url) => ({ key: url, url })))
    },
    [revokeAll],
  )

  const add = useCallback((files: File[]) => {
    const added = files.map((file): PhotoItem => {
      const url = URL.createObjectURL(file)
      objectUrls.current.add(url)
      return { key: url, url, file }
    })
    setPhotos((current) => [...current, ...added])
  }, [])

  const remove = useCallback((key: string) => {
    setPhotos((current) => current.filter((p) => p.key !== key))
    if (objectUrls.current.has(key)) {
      URL.revokeObjectURL(key)
      objectUrls.current.delete(key)
    }
  }, [])

  /** Uploads any newly picked files and returns every photo's final URL. */
  const resolveUrls = useCallback(
    () => Promise.all(photos.map((p) => (p.file ? uploadTenantFile(p.file, folder) : Promise.resolve(p.url)))),
    [photos, folder],
  )

  return { photos, add, remove, reset, resolveUrls }
}
