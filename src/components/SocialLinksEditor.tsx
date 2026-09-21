'use client'
// src/components/SocialLinksEditor.tsx
//
// Settings UI for the landing-page footer "Social links": a repeatable list
// where the creator picks a platform from a dropdown and pastes their link.
// One link per platform (a platform already used is removed from the other
// rows' dropdowns), and any row can be removed.
//
// Controlled component — the parent owns the array and decides when to save.
// Validation comes from src/lib/social-links.ts, the same function the parent
// uses to decide whether it is safe to save.

import { Trash2, Plus } from 'lucide-react'
import { SocialIcon } from '@/components/SocialLinks'
import {
  SOCIAL_PLATFORMS, MAX_SOCIAL_LINKS, getSocialPlatform, getSocialLinksErrors,
  type SocialLink, type SocialPlatformId,
} from '@/lib/social-links'

const INPUT_CLASS =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[var(--kurso-primary)]'

export default function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLink[]
  onChange: (next: SocialLink[]) => void
}) {
  const { errors, hasErrors } = getSocialLinksErrors(value)
  const used = new Set<string>(value.map(v => v.platform))
  const nextFree = SOCIAL_PLATFORMS.find(p => !used.has(p.id))
  const atCap = value.length >= MAX_SOCIAL_LINKS || !nextFree

  function patch(index: number, changes: Partial<SocialLink>) {
    onChange(value.map((e, i) => (i === index ? { ...e, ...changes } : e)))
  }

  function add() {
    if (!nextFree) return
    onChange([...value, { platform: nextFree.id, url: '' }])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--kurso-hint)' }}>
          No social links yet. They&apos;ll appear as logo buttons in your landing page footer.
        </p>
      )}

      {value.map((entry, index) => {
        const platform = getSocialPlatform(entry.platform)
        const err = errors[index]
        return (
          <div key={index} className="rounded-xl p-4 bg-white/5 border border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', color: platform?.color === '#000000' ? '#ffffff' : platform?.color }}
              >
                <SocialIcon platform={entry.platform} size={16} />
              </span>
              <select
                value={entry.platform}
                onChange={e => patch(index, { platform: e.target.value as SocialPlatformId })}
                aria-label={`Platform for social link ${index + 1}`}
                className="flex-1 min-w-0 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer border border-white/10"
                style={{ background: '#050505', colorScheme: 'dark' }}
              >
                {SOCIAL_PLATFORMS.filter(p => p.id === entry.platform || !used.has(p.id)).map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#050505', color: '#fff' }}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${platform?.label ?? 'social'} link`}
                className="p-1.5 text-zinc-500 hover:text-red-500 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <input
                type="url"
                inputMode="url"
                value={entry.url}
                onChange={e => patch(index, { url: e.target.value })}
                placeholder={platform?.placeholder ?? 'https://'}
                aria-label={`${platform?.label ?? 'Social'} link`}
                className={INPUT_CLASS}
                style={err ? { borderColor: 'rgba(239,68,68,0.6)' } : undefined}
              />
              {err && <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>{err}</p>}
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={add}
        disabled={atCap}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.15)' }}
      >
        <Plus className="w-3.5 h-3.5" />
        {atCap ? `All ${MAX_SOCIAL_LINKS} platforms added` : 'Add a social link'}
      </button>

      {hasErrors && (
        <p className="text-xs" style={{ color: 'rgb(237, 152, 128)' }}>
          Your social links aren&apos;t saved yet — fix the highlighted links above and they&apos;ll save
          automatically. Everything else on this page keeps saving as normal.
        </p>
      )}
    </div>
  )
}