'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw, Mail } from 'lucide-react'

const mockPiracyData = [
  {
    id: '1',
    url: 't.me/free_courses_hd/seo_masterclass_full',
    status: 'nuked',
    found_at: '2026-05-08T07:30:00Z',
    filed_at: '2026-05-08T08:12:00Z',
    nuked_at: '2026-05-08T10:45:00Z',
    platform: 'Telegram',
  },
  {
    id: '2',
    url: 't.me/cracked_india_courses/47382',
    status: 'nuked',
    found_at: '2026-05-07T14:20:00Z',
    filed_at: '2026-05-07T15:00:00Z',
    nuked_at: '2026-05-07T17:30:00Z',
    platform: 'Telegram',
  },
  {
    id: '3',
    url: 't.me/vip_courses_2026/seo_course.zip',
    status: 'filed',
    found_at: '2026-05-09T06:00:00Z',
    filed_at: '2026-05-09T06:45:00Z',
    nuked_at: null,
    platform: 'Telegram',
  },
  {
    id: '4',
    url: 't.me/edu_dump_free/seo_creator_2026',
    status: 'detected',
    found_at: '2026-05-09T09:10:00Z',
    filed_at: null,
    nuked_at: null,
    platform: 'Telegram',
  },
  {
    id: '5',
    url: 'drive.google.com/file/d/1abc_seo_masterclass_full',
    status: 'nuked',
    found_at: '2026-05-06T11:00:00Z',
    filed_at: '2026-05-06T11:30:00Z',
    nuked_at: '2026-05-06T20:00:00Z',
    platform: 'Google Drive',
  },
  {
    id: '6',
    url: 't.me/india_free_courses_bot/seo_full_2026',
    status: 'detected',
    found_at: '2026-05-09T10:30:00Z',
    filed_at: null,
    nuked_at: null,
    platform: 'Telegram',
  },
]

const statusConfig = {
  nuked: {
    label: 'Nuked',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.1)',
    border: 'rgba(74,222,128,0.2)',
    icon: CheckCircle,
  },
  filed: {
    label: 'Notice Filed',
    color: '#facc15',
    bg: 'rgba(250,204,21,0.1)',
    border: 'rgba(250,204,21,0.2)',
    icon: Clock,
  },
  detected: {
    label: 'Detected',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.2)',
    icon: AlertTriangle,
  },
}

export default function PiracyPage() {
  const [filter, setFilter] = useState<'all' | 'detected' | 'filed' | 'nuked'>('all')
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState('Today at 9:30 AM')

  const nuked = mockPiracyData.filter(d => d.status === 'nuked').length
  const filed = mockPiracyData.filter(d => d.status === 'filed').length
  const detected = mockPiracyData.filter(d => d.status === 'detected').length

  const filtered = filter === 'all'
    ? mockPiracyData
    : mockPiracyData.filter(d => d.status === filter)

  function handleScan() {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      setLastScan('Just now')
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Piracy Shield</h1>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              Last scan: {lastScan} · Runs every 6 hours automatically
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all violet-gradient hover:opacity-90 glow disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Run Scan Now'}
          </button>
        </div>

        {/* Scanning banner */}
        {scanning && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl"
            style={{background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)'}}>
            <RefreshCw className="w-4 h-4 animate-spin" style={{color:'#8b5cf6'}} />
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              Scanning Telegram and Google for pirated copies of your course...
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Detected', value: mockPiracyData.length, color: '#a1a1aa', bg: 'rgba(255,255,255,0.05)' },
            { label: 'Links Nuked', value: nuked, color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
            { label: 'Notice Filed', value: filed, color: '#facc15', bg: 'rgba(250,204,21,0.08)' },
            { label: 'Active Threats', value: detected, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-5"
              style={{background: s.bg, border:`1px solid ${s.color}22`}}>
              <div className="text-3xl font-bold mb-1" style={{color: s.color}}>{s.value}</div>
              <div className="text-sm" style={{color:'#a1a1aa'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* IT Rules banner */}
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl"
          style={{background:'rgba(74,222,128,0.05)', border:'1px solid rgba(74,222,128,0.15)'}}>
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{color:'#4ade80'}} />
          <div>
            <p className="text-sm font-medium" style={{color:'#4ade80'}}>IT Rules 2026 Active</p>
            <p className="text-xs mt-0.5" style={{color:'#a1a1aa'}}>
              Intermediaries must act on takedown orders within 3 hours. All notices filed automatically to dmca@telegram.org with full legal documentation.
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['all', 'detected', 'filed', 'nuked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize"
              style={{
                background: filter === f ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                border: filter === f ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filter === f ? '#8b5cf6' : '#a1a1aa',
              }}
            >
              {f === 'all' ? `All (${mockPiracyData.length})` :
               f === 'detected' ? `Detected (${detected})` :
               f === 'filed' ? `Filed (${filed})` :
               `Nuked (${nuked})`}
            </button>
          ))}
        </div>

        {/* Piracy feed */}
        <div className="flex flex-col gap-3">
          {filtered.map((item) => {
            const config = statusConfig[item.status as keyof typeof statusConfig]
            const Icon = config.icon
            return (
              <div key={item.id} className="rounded-2xl p-5 transition-all"
                style={{
                  background:'rgba(255,255,255,0.02)',
                  border:`1px solid rgba(255,255,255,0.06)`,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{background: config.bg, border:`1px solid ${config.border}`}}>
                      <Icon className="w-4 h-4" style={{color: config.color}} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{background: config.bg, color: config.color}}>
                          {config.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
                          {item.platform}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-white mt-2 truncate">{item.url}</p>
                      <div className="flex flex-wrap gap-4 mt-2">
                        <span className="text-xs" style={{color:'#52525b'}}>
                          Found: {new Date(item.found_at).toLocaleString('en-IN', {
                            day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
                          })}
                        </span>
                        {item.filed_at && (
                          <span className="text-xs flex items-center gap-1" style={{color:'#52525b'}}>
                            <Mail className="w-3 h-3" />
                            Notice filed: {new Date(item.filed_at).toLocaleString('en-IN', {
                              hour:'2-digit', minute:'2-digit'
                            })}
                          </span>
                        )}
                        {item.nuked_at && (
                          <span className="text-xs flex items-center gap-1" style={{color:'#4ade80'}}>
                            <CheckCircle className="w-3 h-3" />
                            Nuked: {new Date(item.nuked_at).toLocaleString('en-IN', {
                              hour:'2-digit', minute:'2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <a
                    href={`https://${item.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{background:'rgba(255,255,255,0.05)', color:'#52525b'}}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                      e.currentTarget.style.color = '#fff'
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                      e.currentTarget.style.color = '#52525b'
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}