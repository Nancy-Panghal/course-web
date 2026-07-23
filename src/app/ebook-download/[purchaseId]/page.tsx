'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, BookOpen } from 'lucide-react'
import EbookRefundRequestButton from '@/components/EbookRefundRequestButton'

export default function EbookDownloadPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: purchase } = await supabase
        .from('transactions')
        .select('id, status, ebook_download_count, ebook_download_limit, ebooks(title, cover_image_url)')
        .eq('id', purchaseId)
        .eq('product_type', 'ebook')
        .maybeSingle()
      if (!purchase) { setError('This link is invalid.'); setLoading(false); return }
      setData(purchase)
      setLoading(false)
    }
    load()
  }, [purchaseId])

  function handleDownload() {
    setDownloading(true)
    window.location.href = `/api/ebook/download?purchaseId=${purchaseId}`
    setTimeout(() => setDownloading(false), 3000)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#050505' }} />
  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>
      {error || 'Not found'}
    </div>
  )

  const remaining = data.ebook_download_limit - data.ebook_download_count

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(var(--kurso-primary-rgb),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <BookOpen className="w-7 h-7" style={{ color: 'var(--kurso-primary-light)' }} />
        </div>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{data.ebooks?.title}</h1>
        <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 24 }}>
          {remaining > 0 ? `${remaining} of ${data.ebook_download_limit} downloads remaining` : 'Download limit reached — contact the creator to reset it.'}
        </p>
        <button onClick={handleDownload} disabled={downloading || remaining <= 0}
          className="violet-gradient"
          style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontWeight: 700, fontSize: 14, color: '#fff', border: 'none', cursor: 'pointer', opacity: remaining <= 0 ? 0.5 : 1 }}>
          <Download className="w-4 h-4" style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
          {downloading ? 'Preparing your file...' : 'Download PDF'}
        </button>
        <EbookRefundRequestButton purchaseId={purchaseId} />
      </div>
    </div>
  )
}