'use client'

import { useRef, useState } from 'react'
import { ASSIGNMENT_MAX_BYTES, validateAssignmentFile } from '@/lib/assignment-files'

const ACCEPT = '.txt,.md,.markdown,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif'

interface Props {
  sessionToken: string
  lessonId: string
  courseId: string
  enrollmentId: string
  onSubmitted: (submission: {
    status: string
    submission_text?: string | null
    submission_url?: string | null
    submitted_at: string
  }) => void
}

export default function AssignmentSubmit({
  sessionToken,
  lessonId,
  courseId,
  enrollmentId,
  onSubmitted,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    setError('')
    if (!picked) {
      setFile(null)
      return
    }
    const validation = validateAssignmentFile(picked.name, picked.type, picked.size)
    if (!validation.ok) {
      setError(validation.error)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFile(picked)
  }

  async function submit() {
    if (!text.trim() && !file) {
      setError('Type an answer or attach a file')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      let submissionUrl: string | undefined

      if (file) {
        const form = new FormData()
        form.append('file', file)
        form.append('lessonId', lessonId)
        form.append('courseId', courseId)
        form.append('enrollmentId', enrollmentId)

        const uploadRes = await fetch('/api/assignments/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: form,
        })
        const uploadJson = await uploadRes.json()
        if (!uploadRes.ok) {
          setError(uploadJson.error || 'File upload failed')
          return
        }
        submissionUrl = uploadJson.submissionUrl
      }

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          lessonId,
          courseId,
          enrollmentId,
          submissionText: text.trim() || undefined,
          submissionUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Submission failed')
        return
      }

      onSubmitted({
        status: json.status || 'pending',
        submission_text: text.trim() || null,
        submission_url: submissionUrl || null,
        submitted_at: new Date().toISOString(),
      })
      setText('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = (text.trim().length > 0 || file) && !submitting

  return (
    <div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your answer here (optional if you attach a file)…"
        rows={4}
        maxLength={2000}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: 13, resize: 'vertical',
          outline: 'none', marginBottom: 8, boxSizing: 'border-box',
        }}
      />
      <div style={{ marginBottom: 10 }}>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          style={{ fontSize: 12, color: '#a1a1aa' }}
        />
        <p style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>
          TXT, Markdown, PDF, Word, or images — max {ASSIGNMENT_MAX_BYTES / (1024 * 1024)} MB
        </p>
        {file && (
          <p style={{ fontSize: 11, color: '#a78bfa', marginTop: 4 }}>
            Selected: {file.name}
          </p>
        )}
      </div>
      {error && (
        <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{error}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#52525b' }}>{text.length}/2000</span>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            padding: '8px 18px', borderRadius: 10,
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: !canSubmit ? 'not-allowed' : 'pointer',
            opacity: !canSubmit ? 0.5 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Assignment'}
        </button>
      </div>
    </div>
  )
}
