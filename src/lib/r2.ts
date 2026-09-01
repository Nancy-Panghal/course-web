/**
 * src/lib/r2.ts
 * ─────────────────────────────────────────────────────────────────
 * Cloudflare R2 storage — S3-compatible, so this uses the standard
 * AWS SDK pointed at R2's endpoint. R2 has zero egress fees, unlike
 * Supabase Storage, which is why video/ebook files live here.
 *
 * Every function here mirrors a Supabase Storage call already used
 * elsewhere in the app (upload / createSignedUrl / remove), so the
 * routes that call into this file read almost identically to the
 * Supabase versions they replace.
 * ─────────────────────────────────────────────────────────────────
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

/**
 * Upload a file to R2. Mirrors `supabase.storage.from(bucket).upload(path, file)`.
 * Returns the storage key (the path within the bucket) on success.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<{ key: string } | { error: string }> {
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
    return { key }
  } catch (err: any) {
    return { error: err.message || 'R2 upload failed' }
  }
}

/**
 * Generate a short-lived signed URL for a private R2 object.
 * Mirrors `supabase.storage.from(bucket).createSignedUrl(path, seconds)`.
 * Same rule as the Supabase version this replaces: this is for
 * SERVER-SIDE use only inside a proxy route — never send the result
 * of this function directly to the browser.
 */
export async function getR2SignedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
  try {
    const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    return await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
  } catch {
    return null
  }
}

/**
 * Delete an object from R2. Mirrors `supabase.storage.from(bucket).remove([path])`.
 */
export async function deleteFromR2(key: string): Promise<{ error: string | null }> {
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    return { error: null }
  } catch (err: any) {
    return { error: err.message || 'R2 delete failed' }
  }
}

/**
 * Generate a short-lived presigned URL the BROWSER can PUT a file to directly.
 * This is how uploads reach R2 without the file passing through a Vercel
 * function first (Vercel has a request body size limit that large videos
 * would blow past — this sidesteps that entirely, same reason the app
 * already does direct signed uploads for Supabase Storage).
 */
export async function getR2UploadUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<string | null> {
  try {
    const command = new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, ContentType: contentType })
    return await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
  } catch {
    return null
  }
}