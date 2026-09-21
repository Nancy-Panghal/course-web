'use client'
// src/components/ContactDetailsEditor.tsx
//
// Settings UI for the landing-page "Contact details" feature: up to 2 phone
// numbers + 2 emails, each with its own short message and two independent
// placement checkboxes (below the description / footer).
//
// This is a controlled component — the parent owns the array and decides
// when to save. Validation comes from src/lib/contact-details.ts, the same
// function the parent uses to decide whether it is safe to save.

import { useState } from 'react'
import { Trash2, Plus, Phone, Mail } from 'lucide-react'
import {
  MAX_PHONES, MAX_EMAILS, MAX_CONTACT_MESSAGE_CHARS, MAX_CONTACT_MESSAGE_WORDS,
  countWords, getContactDetailsErrors,
  type ContactDetail, type ContactType,
} from '@/lib/contact-details'

const INPUT_CLASS =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[var(--kurso-primary)]'

const CONFIG: Record<ContactType, {
  heading: string
  max: number
  addLabel: string
  valueLabel: string
  valuePlaceholder: string
  messagePlaceholder: string
  inputType: string
  singular: string
  plural: string
}> = {
  phone: {
    heading: 'Phone numbers',
    max: MAX_PHONES,
    addLabel: 'Add phone number',
    valueLabel: 'Phone number',
    valuePlaceholder: '+91 98765 43210',
    messagePlaceholder: 'e.g. Call us for details',
    inputType: 'tel',
    singular: 'phone number',
    plural: 'phone numbers',
  },
  email: {
    heading: 'Email addresses',
    max: MAX_EMAILS,
    addLabel: 'Add email address',
    valueLabel: 'Email address',
    valuePlaceholder: 'you@example.com',
    messagePlaceholder: 'e.g. Email us your queries',
    inputType: 'email',
    singular: 'email address',
    plural: 'email addresses',
  },
}

export default function ContactDetailsEditor({
  value,
  onChange,
}: {
  value: ContactDetail[]
  onChange: (next: ContactDetail[]) => void
}) {
  // "Use this message for both" — a UI convenience only. The saved data
  // always holds one message per entry.
  const [sync, setSync] = useState<Record<ContactType, boolean>>({ phone: false, email: false })

  const { errors, hasErrors } = getContactDetailsErrors(value)
  const indexed = value.map((entry, index) => ({ entry, index }))

  function indicesOf(type: ContactType) {
    return indexed.filter(x => x.entry.type === type).map(x => x.index)
  }

  function patch(index: number, changes: Partial<ContactDetail>) {
    onChange(value.map((e, i) => (i === index ? { ...e, ...changes } : e)))
  }

  function setMessage(index: number, text: string) {
    const type = value[index].type
    const targets = new Set<number>([index])
    if (sync[type]) indicesOf(type).forEach(i => targets.add(i))
    onChange(value.map((e, i) => (targets.has(i) ? { ...e, message: text } : e)))
  }

  function toggleSync(type: ContactType, on: boolean) {
    setSync(prev => ({ ...prev, [type]: on }))
    if (!on) return
    const idx = indicesOf(type)
    const source = idx.find(i => value[i].message.trim()) ?? idx[0]
    if (source === undefined) return
    const text = value[source].message
    onChange(value.map((e, i) => (idx.includes(i) ? { ...e, message: text } : e)))
  }

  function add(type: ContactType) {
    if (indicesOf(type).length >= CONFIG[type].max) return
    onChange([
      ...value,
      { type, value: '', message: '', show_below_description: true, show_in_footer: true },
    ])
  }

  function remove(index: number) {
    const type = value[index].type
    const remaining = indicesOf(type).length - 1
    if (remaining < 2) setSync(prev => ({ ...prev, [type]: false }))
    onChange(value.filter((_, i) => i !== index))
  }

  function renderGroup(type: ContactType) {
    const cfg = CONFIG[type]
    const Icon = type === 'phone' ? Phone : Mail
    const rows = indexed.filter(x => x.entry.type === type)
    const atCap = rows.length >= cfg.max

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Icon className="w-4 h-4 text-zinc-400" />
            {cfg.heading}
          </span>
          <span className="text-xs" style={{ color: 'var(--kurso-hint)' }}>
            {rows.length} / {cfg.max}
          </span>
        </div>

        {rows.map(({ entry, index }, n) => {
          const err = errors[index] || {}
          const chars = entry.message.length
          const words = countWords(entry.message)
          const msgOver = chars > MAX_CONTACT_MESSAGE_CHARS || words > MAX_CONTACT_MESSAGE_WORDS
          const shownNowhere =
            entry.value.trim() && !err.value && !entry.show_below_description && !entry.show_in_footer

          return (
            <div key={index} className="rounded-xl p-4 bg-white/5 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">
                  {type === 'phone' ? 'Phone' : 'Email'} {n + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${cfg.singular} ${n + 1}`}
                  className="p-1.5 text-zinc-500 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">{cfg.valueLabel}</label>
                <input
                  type={cfg.inputType}
                  value={entry.value}
                  onChange={e => patch(index, { value: e.target.value })}
                  placeholder={cfg.valuePlaceholder}
                  className={INPUT_CLASS}
                  style={err.value ? { borderColor: 'rgba(239,68,68,0.6)' } : undefined}
                />
                {err.value && (
                  <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>{err.value}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
                  Short message (optional)
                </label>
                <input
                  value={entry.message}
                  maxLength={MAX_CONTACT_MESSAGE_CHARS}
                  onChange={e => setMessage(index, e.target.value)}
                  placeholder={cfg.messagePlaceholder}
                  className={INPUT_CLASS}
                  style={msgOver || err.message ? { borderColor: 'rgba(239,68,68,0.6)' } : undefined}
                />
                <p className="text-xs mt-1.5" style={{ color: msgOver ? '#ef4444' : 'var(--kurso-hint)' }}>
                  {chars}/{MAX_CONTACT_MESSAGE_CHARS} characters · {words}/{MAX_CONTACT_MESSAGE_WORDS} words
                </p>
                {err.message && (
                  <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{err.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <span className="text-xs font-medium text-zinc-400">Show this on my landing page:</span>
                <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.show_below_description}
                    onChange={e => patch(index, { show_below_description: e.target.checked })}
                    className="h-4 w-4 accent-[var(--kurso-primary)]"
                  />
                  Below the course description
                </label>
                <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.show_in_footer}
                    onChange={e => patch(index, { show_in_footer: e.target.checked })}
                    className="h-4 w-4 accent-[var(--kurso-primary)]"
                  />
                  In the footer
                </label>
                {shownNowhere && (
                  <p className="text-xs" style={{ color: 'rgb(237, 152, 128)' }}>
                    This {cfg.singular} isn&apos;t shown anywhere yet — tick at least one place.
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {rows.length === 2 && (
          <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sync[type]}
              onChange={e => toggleSync(type, e.target.checked)}
              className="h-4 w-4 accent-[var(--kurso-primary)]"
            />
            Use the same message for both {cfg.plural}
          </label>
        )}

        <button
          type="button"
          onClick={() => add(type)}
          disabled={atCap}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.15)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          {atCap ? `Maximum of ${cfg.max} ${cfg.plural} reached` : cfg.addLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {renderGroup('phone')}
      {renderGroup('email')}

      {hasErrors && (
        <p className="text-xs" style={{ color: 'rgb(237, 152, 128)' }}>
          Your contact details aren&apos;t saved yet — fix the highlighted fields above and they&apos;ll save
          automatically. Everything else on this page keeps saving as normal.
        </p>
      )}
    </div>
  )
}