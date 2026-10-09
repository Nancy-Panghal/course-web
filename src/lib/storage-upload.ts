// src/lib/storage-upload.ts
//
// One place for uploading public files to the existing 'lessons' storage
// bucket (same bucket and folder convention the course screens use:
// 'images', 'brand-logos', 'policies/<id>', ...). New screens should use this
// instead of writing yet another local uploadToSupabase().
import { supabase } from './supabase'
import { MAX_POLICY_FILE_BYTES } from './policyDocs'

const BUCKET = 'lessons'
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const DEFAULT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function putFile(file: File, folder: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${folder}/${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) {
    console.error('[upload] failed', error)
    throw new Error(`Upload failed: ${error.message}`)
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Uploads an image and returns its public URL. Throws an Error with a
 *  creator-readable message on any problem. */
export async function uploadPublicImage(
  file: File,
  folder: string,
  opts: { maxBytes?: number; allowedTypes?: string[]; typeError?: string } = {}
): Promise<string> {
  const allowed = opts.allowedTypes ?? DEFAULT_IMAGE_TYPES
  const maxBytes = opts.maxBytes ?? MAX_IMAGE_BYTES
  if (!allowed.includes(file.type)) {
    throw new Error(opts.typeError ?? 'Please choose a JPG, PNG, WebP or GIF image.')
  }
  if (file.size > maxBytes) {
    throw new Error(`Image must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.`)
  }
  return putFile(file, folder)
}

/** Uploads a policy document (.txt or .md, up to 20 KB, same rules as courses). */
export async function uploadPolicyDoc(file: File, folder: string): Promise<string> {
  if (!/\.(md|txt)$/i.test(file.name)) throw new Error('Please upload a .txt or .md file.')
  if (file.size > MAX_POLICY_FILE_BYTES) throw new Error(`File must be ${MAX_POLICY_FILE_BYTES / 1024}KB or smaller.`)
  return putFile(file, folder)
}

/** Best-effort delete of a file previously uploaded here, by its public URL.
 *  Never throws: a failed cleanup must not break a save. */
export async function removePublicFile(publicUrl: string): Promise<void> {
  try {
    const marker = `/${BUCKET}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return
    await supabase.storage.from(BUCKET).remove([publicUrl.slice(idx + marker.length)])
  } catch (err) {
    console.error('[upload] cleanup failed (ignored)', err)
  }
}