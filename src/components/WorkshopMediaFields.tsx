'use client'
// src/components/WorkshopMediaFields.tsx
//
// Upload-based fields for the workshop settings: a single image (host photo,
// brand logo, cover), a policy document, and the testimonials editor.
// Uploading itself is passed in (see lib/storage-upload.ts) so these stay
// plain UI. Same legibility rules as WorkshopFormFields.tsx.

import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { TextInput, TextArea } from '@/components/WorkshopFormFields'
import { WORKSHOP_CONTENT_LIMITS, type WorkshopTestimonial } from '@/lib/workshop-validation'

const BTN_STYLE = { background: 'rgba(255,255,255,0.08)', color: 'var(--kurso-text-secondary)' } as const
const BTN_CLASS = 'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer'

// ─── One image ──────────────────────────────────────────────────────────────

const SHAPES = {
  circle: { box: 'w-20 h-20 rounded-full', fit: 'object-cover' },
  square: { box: 'w-20 h-20 rounded-xl', fit: 'object-contain' },
  wide: { box: 'w-40 h-[90px] rounded-xl', fit: 'object-cover' },
} as const

export function ImageUploadField({ id, value, onChange, onUpload, onError, shape, fallback, uploadLabel }: {
  id: string
  value: string
  onChange: (url: string) => void
  onUpload: (file: File) => Promise<string>
  onError: (message: string) => void
  shape: keyof typeof SHAPES
  /** Shown inside the empty preview (e.g. the host's first letter). */
  fallback?: string
  uploadLabel?: string
}) {
  const [uploading, setUploading] = useState(false)
  const s = SHAPES[shape]

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      onChange(await onUpload(file))
    } catch (err: any) {
      onError(err?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className={`${s.box} overflow-hidden flex items-center justify-center shrink-0`}
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}>
        {value
          ? <img src={value} alt="" className={`w-full h-full ${s.fit}`} />
          : <span className="text-2xl font-bold" style={{ color: 'var(--kurso-text-secondary)' }}>{fallback || ''}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={handleFile} disabled={uploading} />
        <label htmlFor={id} className={BTN_CLASS} style={BTN_STYLE}>
          {uploading ? 'Uploading…' : value ? 'Change' : (uploadLabel || 'Upload image')}
        </label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-sm underline"
            style={{ color: 'var(--kurso-text-secondary)' }}>Remove</button>
        )}
      </div>
    </div>
  )
}

// ─── One policy document (.txt / .md) ───────────────────────────────────────

export function PolicyDocField({ id, label, value, onChange, onUpload, onError }: {
  id: string
  label: string
  value: string
  onChange: (url: string) => void
  onUpload: (file: File) => Promise<string>
  onError: (message: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      onChange(await onUpload(file))
    } catch (err: any) {
      onError(err?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[13px]" style={{ color: 'var(--kurso-text-muted)' }}>
          {value
            ? <>Uploaded · <a href={value} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--kurso-primary-lightest)' }}>View file</a></>
            : 'Not uploaded yet'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input id={id} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden"
          onChange={handleFile} disabled={uploading} />
        <label htmlFor={id} className={BTN_CLASS} style={BTN_STYLE}>
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload file'}
        </label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-sm underline"
            style={{ color: 'var(--kurso-text-secondary)' }}>Remove</button>
        )}
      </div>
    </div>
  )
}

// ─── Testimonials ───────────────────────────────────────────────────────────

export function TestimonialsEditor({ value, onChange, onUpload, onError }: {
  value: WorkshopTestimonial[]
  onChange: (next: WorkshopTestimonial[]) => void
  onUpload: (file: File, kind: 'photo' | 'screenshot') => Promise<string>
  onError: (message: string) => void
}) {
  const max = WORKSHOP_CONTENT_LIMITS.testimonials
  const patch = (i: number, item: WorkshopTestimonial) => onChange(value.map((t, idx) => (idx === i ? item : t)))

  return (
    <div className="flex flex-col gap-4">
      {value.map((t, i) => (
        <div key={i} className="rounded-xl p-4 flex flex-col gap-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between gap-3">
            <div role="group" aria-label={`Testimonial ${i + 1} type`} className="inline-flex p-1 rounded-lg gap-1"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {(['written', 'screenshot'] as const).map(kind => (
                <button key={kind} type="button" aria-pressed={t.type === kind}
                  onClick={() => t.type !== kind && patch(i, kind === 'written'
                    ? { type: 'written', name: '', text: '', rating: 5 }
                    : { type: 'screenshot', image_url: '' })}
                  className="px-3 py-1.5 rounded-md text-[13px] font-medium"
                  style={t.type === kind
                    ? { background: 'rgba(var(--kurso-primary-rgb), 0.18)', color: 'var(--kurso-primary-lightest)' }
                    : { color: 'var(--kurso-text-secondary)' }}>
                  {kind === 'written' ? 'Written' : 'Screenshot'}
                </button>
              ))}
            </div>
            <button type="button" aria-label={`Remove testimonial ${i + 1}`}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--kurso-text-secondary)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {t.type === 'written' ? (
            <>
              <TextInput aria-label={`Testimonial ${i + 1} name`} value={t.name}
                maxLength={WORKSHOP_CONTENT_LIMITS.testimonialName} placeholder="Attendee name"
                onChange={v => patch(i, { ...t, name: v })} />
              <TextArea aria-label={`Testimonial ${i + 1} text`} rows={3} value={t.text}
                maxLength={WORKSHOP_CONTENT_LIMITS.testimonialText} placeholder="What did they say?"
                onChange={v => patch(i, { ...t, text: v })} />
              <div role="group" aria-label={`Testimonial ${i + 1} rating`} className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button" aria-label={`${star} star${star > 1 ? 's' : ''}`} aria-pressed={t.rating === star}
                    onClick={() => patch(i, { ...t, rating: star })}>
                    <Star className="w-6 h-6" style={{ color: 'var(--kurso-primary-light)' }} fill={star <= t.rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
              <div>
                <p className="text-[13px] mb-2" style={{ color: 'var(--kurso-text-muted)' }}>Attendee photo (optional, JPG or PNG, up to 5MB)</p>
                <ImageUploadField id={`testimonial-photo-${i}`} shape="circle" value={t.photo_url || ''}
                  fallback={(t.name || '?').charAt(0).toUpperCase()} uploadLabel="Upload photo"
                  onChange={url => patch(i, { ...t, photo_url: url || undefined })}
                  onUpload={file => onUpload(file, 'photo')} onError={onError} />
              </div>
            </>
          ) : (
            <div>
              <p className="text-[13px] mb-2" style={{ color: 'var(--kurso-text-muted)' }}>Screenshot of a message or review (JPG or PNG, up to 5MB)</p>
              <ImageUploadField id={`testimonial-shot-${i}`} shape="wide" value={t.image_url} uploadLabel="Upload screenshot"
                onChange={url => patch(i, { ...t, image_url: url })}
                onUpload={file => onUpload(file, 'screenshot')} onError={onError} />
            </div>
          )}
        </div>
      ))}

      {value.length < max ? (
        <button type="button" onClick={() => onChange([...value, { type: 'written', name: '', text: '', rating: 5 }])}
          className="self-start text-sm font-medium" style={{ color: 'var(--kurso-primary-lightest)' }}>
          + Add testimonial
        </button>
      ) : (
        <p className="text-[13px]" style={{ color: 'var(--kurso-text-muted)' }}>Maximum of {max} testimonials reached.</p>
      )}
    </div>
  )
}