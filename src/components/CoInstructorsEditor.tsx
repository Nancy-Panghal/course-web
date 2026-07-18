'use client'
import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'

export type CoInstructor = {
  name: string
  title: string
  image: string
  bio: string
}

/**
 * Repeatable list editor for CO-instructors (instructor #1 stays on the
 * existing host_name / about_creator / host_image / instructor_title
 * columns everywhere else in the app — certificates, slugs, emails, etc.
 * all keep working untouched). This only manages the EXTRA instructors
 * shown alongside the primary one on the course landing page.
 */
export default function CoInstructorsEditor({
  value,
  onChange,
  onUpload,
}: {
  value: CoInstructor[]
  onChange: (next: CoInstructor[]) => void
  onUpload: (file: File) => Promise<string>
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')

  function update(index: number, field: keyof CoInstructor, val: string) {
    const next = [...value]
    next[index] = { ...next[index], [field]: val }
    onChange(next)
  }

  function add() {
    onChange([...value, { name: '', title: '', image: '', bio: '' }])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  async function handleUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be 2MB or smaller.')
      return
    }
    setUploadError('')
    setUploadingIndex(index)
    try {
      const url = await onUpload(file)
      update(index, 'image', url)
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.')
    } finally {
      setUploadingIndex(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((instructor, i) => (
        <div key={i} className="rounded-xl p-4 bg-white/5 border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Co-instructor {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="p-1.5 text-zinc-500 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              {instructor.image ? (
                <img src={instructor.image} alt={instructor.name || 'Co-instructor'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-zinc-700">
                  {instructor.name ? instructor.name.charAt(0).toUpperCase() : '?'}
                </span>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                id={`co-instructor-image-${i}`}
                className="hidden"
                accept="image/*"
                onChange={e => handleUpload(i, e)}
                disabled={uploadingIndex === i}
              />
              <label
                htmlFor={`co-instructor-image-${i}`}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10 transition-all"
              >
                {uploadingIndex === i ? 'Uploading...' : 'Photo'}
              </label>
            </div>
          </div>
          <input
            value={instructor.name}
            onChange={e => update(i, 'name', e.target.value)}
            placeholder="Name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
          />
          <input
            value={instructor.title}
            onChange={e => update(i, 'title', e.target.value)}
            placeholder="Title / Credentials (e.g. Co-founder, Nutrition Coach)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
          />
          <textarea
            value={instructor.bio}
            onChange={e => update(i, 'bio', e.target.value)}
            rows={2}
            placeholder="Short bio"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none"
          />
        </div>
      ))}

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl w-fit transition-all bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Add another instructor
      </button>
    </div>
  )
}