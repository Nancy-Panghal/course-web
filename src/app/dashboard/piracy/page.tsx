'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw, Mail } from 'lucide-react'

interface PiracyReport {
  id: string
  url: string
  status: 'nuked' | 'filed' | 'detected'
  found_at: string
  filed_at: string | null
  nuked_at: string | null
  platform: string
}

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
  const [piracyData, setPiracyData] = useState<PiracyReport[]>([])
  const [filter, setFilter] = useState<'all' | 'detected' | 'filed' | 'nuked'>('all')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastScan, setLastScan] = useState('Never')

  useEffect(() => {
    fetchPiracyData()
  }, [])

  async function fetchPiracyData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('piracy_reports')
        .select('*')
        .order('found_at', { ascending: false })
      
      if (data) setPiracyData(data)
    } catch (e) {
      // Table might not exist yet
    } finally {
      setLoading(false)
    }
  }

  const nuked = piracyData.filter(d => d.status === 'nuked').length
  const filed = piracyData.filter(d => d.status === 'filed').length
  const detected = piracyData.filter(d => d.status === 'detected').length

  const filtered = filter === 'all'
    ? piracyData
    : piracyData.filter(d => d.status === filter)

  function handleScan() {
    setScanning(true)
    // In a real app, this would trigger a GitHub Action or a backend worker
    setTimeout(() => {
      setScanning(false)
      setLastScan('Just now')
      fetchPiracyData()
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
            { label: 'Total Detected', value: piracyData.length, color: '#a1a1aa', bg: 'rgba(255,255,255,0.05)' },
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
              {f === 'all' ? `All (${piracyData.length})` :
               f === 'detected' ? `Detected (${detected})` :
               f === 'filed' ? `Filed (${filed})` :
               `Nuked (${nuked})`}
            </button>
          ))}
        </div>

        {/* Piracy feed */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-24 text-center glass rounded-2xl">
              <div className="w-8 h-8 border-2 border-violet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm" style={{color:'#a1a1aa'}}>Fetching reports...</p>
            </div>
          ) : piracyData.length === 0 ? (
            <div className="py-24 text-center glass rounded-2xl"
              style={{border:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)'}}>
                <Shield className="w-8 h-8" style={{color:'#8b5cf6'}} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Shield Active</h3>
              <p className="text-sm" style={{color:'#a1a1aa'}}>
                No pirated links have been detected yet. Our scanner runs every 6 hours.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
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
            })
          )}
        </div>
      </main>
    </div>
  )
}