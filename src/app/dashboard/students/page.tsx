'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { Users, Search, Phone, BookOpen, Calendar, TrendingUp } from 'lucide-react'

interface Student {
  id: string
  phone: string
  current_lesson: number
  enrolled_at: string
  course_id: string | null
}

interface Lesson {
  order_num: number
  title: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchData() {
      const [{ data: s }, { data: l }] = await Promise.all([
        supabase.from('enrollments').select('*').order('enrolled_at', { ascending: false }),
        supabase.from('lessons').select('order_num, title').order('order_num'),
      ])
      setStudents(s || [])
      setLessons(l || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalLessons = lessons.length
  const filtered = students.filter(s => s.phone.includes(search))

  function getProgress(currentLesson: number) {
    if (totalLessons === 0) return 0
    return Math.min(Math.round(((currentLesson - 1) / totalLessons) * 100), 100)
  }

  function getCurrentLessonTitle(currentLesson: number) {
    const lesson = lessons.find(l => l.order_num === currentLesson)
    return lesson ? lesson.title : currentLesson > totalLessons ? 'Completed ✓' : 'Not started'
  }

  function getStatusColor(currentLesson: number) {
    if (currentLesson > totalLessons) return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', label: 'Completed' }
    if (currentLesson === 1) return { bg: 'rgba(250,204,21,0.1)', color: '#facc15', label: 'Just started' }
    return { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6', label: 'In progress' }
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Students</h1>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              {students.length} enrolled student{students.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#52525b'}} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by phone..."
              className="pl-10 pr-4 py-2.5 rounded-xl text-sm text-white outline-none w-64"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: students.length, icon: Users, color: '#8b5cf6' },
            { label: 'Completed', value: students.filter(s => s.current_lesson > totalLessons).length, icon: TrendingUp, color: '#4ade80' },
            { label: 'In Progress', value: students.filter(s => s.current_lesson <= totalLessons && s.current_lesson > 1).length, icon: BookOpen, color: '#3b82f6' },
            { label: 'Just Started', value: students.filter(s => s.current_lesson === 1).length, icon: Calendar, color: '#facc15' },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="rounded-2xl p-4 glass"
                style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{color: s.color}} />
                  <span className="text-xs" style={{color:'#a1a1aa'}}>{s.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
              </div>
            )
          })}
        </div>

        {/* Students table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl p-16 text-center glass"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)'}}>
              <Users className="w-8 h-8" style={{color:'#8b5cf6'}} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No students yet</h3>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              Students appear here after they enroll and pay for your course.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{background:'rgba(255,255,255,0.03)', color:'#52525b', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="col-span-3">Phone</div>
              <div className="col-span-3">Current Lesson</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Enrolled</div>
            </div>

            {/* Table rows */}
            {filtered.map((student, i) => {
              const progress = getProgress(student.current_lesson)
              const status = getStatusColor(student.current_lesson)
              return (
                <div key={student.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-all"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Phone */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{background:'rgba(124,58,237,0.1)'}}>
                      <Phone className="w-3.5 h-3.5" style={{color:'#8b5cf6'}} />
                    </div>
                    <span className="text-sm text-white font-mono">+{student.phone}</span>
                  </div>

                  {/* Current lesson */}
                  <div className="col-span-3">
                    <p className="text-sm text-white truncate">{getCurrentLessonTitle(student.current_lesson)}</p>
                    <p className="text-xs mt-0.5" style={{color:'#52525b'}}>Lesson {student.current_lesson} of {totalLessons}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                        <div className="h-1.5 rounded-full transition-all"
                          style={{width:`${progress}%`, background:'#8b5cf6'}} />
                      </div>
                      <span className="text-xs flex-shrink-0" style={{color:'#a1a1aa'}}>{progress}%</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{background: status.bg, color: status.color}}>
                      {status.label}
                    </span>
                  </div>

                  {/* Enrolled date */}
                  <div className="col-span-2">
                    <span className="text-xs" style={{color:'#52525b'}}>
                      {new Date(student.enrolled_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}