'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield, CheckCircle, Download, Share2, Award,
  Calendar, Hash, User, BookOpen, ExternalLink, Copy, Check,
} from 'lucide-react'

interface CertData {
  certificate_id: string
  student_name:   string
  course_name:    string
  creator_name:   string
  issued_at:      string
  pdf_url:        string
}

interface Props {
  params: Promise<{ id: string }>
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function CertificateVerifyPage({ params }: Props) {
  const [certId, setCertId] = useState<string | null>(null)
  const [cert, setCert]     = useState<CertData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied]     = useState(false)

  // Resolve params promise (Next.js-style prop)
  useEffect(() => {
    params.then(p => setCertId(p.id))
  }, [params])

  // Fetch certificate data
  useEffect(() => {
    if (!certId) return
    const BASE = (process.env.BASE_URL || '/').replace(/\/$/, '')
    fetch(`${BASE}/api/certificate/${encodeURIComponent(certId)}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (data) setCert(data)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [certId])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, border: '3px solid rgba(212,175,55,0.15)', borderTopColor: '#d4af37', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a', fontSize: 14 }}>Verifying certificate…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Not Found ──────────────────────────────────────────────────────────────
  if (notFound || !cert) {
    return (
      <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Hash className="w-8 h-8" style={{ color: '#f87171' }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Certificate Not Found</h1>
        <p style={{ color: '#71717a', fontSize: 14, marginBottom: 28, textAlign: 'center', maxWidth: 320 }}>
          This certificate ID doesn't match any record in our system. It may be invalid or the link may be incorrect.
        </p>
        <Link href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Back to Home
        </Link>
      </div>
    )
  }

  // ── Verified ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>

      {/* Nav */}
      <nav style={{
        height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>AcademyKit</span>
        </Link>
        <span style={{ fontSize: 12, color: '#52525b' }}>Certificate Verification</span>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 16px 80px' }}>

        {/* Verified badge */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 20px', borderRadius: 100,
            background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
          }}>
            <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', letterSpacing: '0.05em' }}>
              CERTIFICATE VERIFIED
            </span>
          </div>
          <p style={{ color: '#52525b', fontSize: 13, marginTop: 10 }}>
            This certificate is authentic and was issued by AcademyKit.
          </p>
        </div>

        {/* Certificate card */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(212,175,55,0.25)',
          background: 'rgba(255,255,255,0.03)',
          boxShadow: '0 0 60px rgba(212,175,55,0.06)',
        }}>

          {/* Gold header bar */}
          <div style={{
            background: 'linear-gradient(135deg, #8b6914, #c9a227, #f0d060, #c9a227, #8b6914)',
            padding: '22px 32px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              <Award className="w-5 h-5" style={{ color: '#3d2b1f' }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#3d2b1f' }}>
                CERTIFICATE OF COMPLETION
              </span>
              <Award className="w-5 h-5" style={{ color: '#3d2b1f' }} />
            </div>
            <p style={{ fontSize: 12, color: '#5c3f1a', margin: 0 }}>issued by AcademyKit</p>
          </div>

          {/* Body */}
          <div style={{ padding: '36px 32px 28px', textAlign: 'center' }}>

            {/* "This certifies that" */}
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 12, fontStyle: 'italic' }}>
              This certifies that
            </p>

            {/* Student name */}
            <h1 style={{
              fontSize: 'clamp(1.6rem,5vw,2.4rem)',
              fontWeight: 800,
              color: '#fff',
              marginBottom: 8,
              lineHeight: 1.1,
            }}>
              {cert.student_name}
            </h1>

            {/* Gold underline */}
            <div style={{ width: 120, height: 2, background: 'linear-gradient(90deg,transparent,#c9a227,transparent)', margin: '0 auto 20px' }} />

            {/* "has successfully completed" */}
            <p style={{ fontSize: 14, color: '#71717a', marginBottom: 16, fontStyle: 'italic' }}>
              has successfully completed
            </p>

            {/* Course name */}
            <h2 style={{
              fontSize: 'clamp(1.1rem,3vw,1.5rem)',
              fontWeight: 700,
              color: '#d4af37',
              marginBottom: 24,
              lineHeight: 1.3,
            }}>
              {cert.course_name}
            </h2>

            {/* Meta grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
              gap: 16,
              padding: '20px 0',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 24,
              textAlign: 'left',
            }}>
              {[
                { icon: User,     label: 'Presented by',  value: cert.creator_name },
                { icon: Calendar, label: 'Date Issued',   value: fmt(cert.issued_at) },
                { icon: Hash,     label: 'Certificate ID', value: cert.certificate_id },
                { icon: BookOpen, label: 'Platform',      value: 'AcademyKit' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: '#d4af37' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#52525b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 600, wordBreak: 'break-all' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a
                href={cert.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px', borderRadius: 12,
                  background: 'linear-gradient(135deg,#8b6914,#c9a227)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                <Download className="w-4 h-4" />
                Download Certificate
              </a>

              <button
                onClick={copyLink}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 20px', borderRadius: 12,
                  background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: copied ? '#4ade80' : '#a1a1aa',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>

              <a
                href={cert.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 20px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#a1a1aa', fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                <ExternalLink className="w-4 h-4" />
                View PDF
              </a>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 32px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />
            <span style={{ fontSize: 11, color: '#52525b' }}>
              Verified on AcademyKit · Certificate ID: <span style={{ color: '#71717a', fontFamily: 'monospace' }}>{cert.certificate_id}</span>
            </span>
          </div>
        </div>

        {/* Trust note */}
        <div style={{
          marginTop: 24, padding: '16px 20px', borderRadius: 12,
          background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.1)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
          <p style={{ fontSize: 12, color: '#71717a', margin: 0, lineHeight: 1.6 }}>
            This certificate was automatically generated by AcademyKit upon verified course completion.
            The certificate ID <strong style={{ color: '#a1a1aa' }}>{cert.certificate_id}</strong> is unique
            and cryptographically recorded in our system. This page serves as the official proof of authenticity.
          </p>
        </div>

      </div>
    </div>
  )
}
