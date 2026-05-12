'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  Plus, BookOpen, Users, Eye, Globe,
  MessageCircle, Monitor, MoreVertical,
  CheckCircle, Clock, ExternalLink
} from 'lucide-react'

interface Course {
  id: string
  name: string
  slug: string
  description: string
  price: number
  delivery: string
  is_published: boolean
  total_lessons: number
  created_at: string
}

const deliveryIcon: Record<string, any> = {
  web: Monitor,
  whatsapp: MessageCircle,
  both: Globe,
}

const deliveryLabel: Record<string, string> = {
  web: 'Web Only',
  whatsapp: 'WhatsApp Only',
  both: 'Web + WhatsApp',
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCourses()
  }, [])

  async function fetchCourses() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })

    setCourses(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Courses</h1>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              {courses.length} course{courses.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <Link href="/dashboard/courses/create"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow">
            <Plus className="w-4 h-4" />
            Create Course
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl p-16 text-center glass"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)'}}>
              <BookOpen className="w-8 h-8" style={{color:'#8b5cf6'}} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No courses yet</h3>
            <p className="text-sm mb-6" style={{color:'#a1a1aa'}}>
              Create your first course and start delivering it to students.
            </p>
            <Link href="/dashboard/courses/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow">
              <Plus className="w-4 h-4" />
              Create First Course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map(course => {
              const DeliveryIcon = deliveryIcon[course.delivery] || Globe
              return (
                <div key={course.id} className="rounded-2xl p-6 glass transition-all"
                  style={{border:'1px solid rgba(255,255,255,0.06)'}}>

                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-white truncate">{course.name}</h3>
                        {course.is_published ? (
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.2)'}}>
                            Live
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{background:'rgba(255,255,255,0.05)', color:'#52525b', border:'1px solid rgba(255,255,255,0.08)'}}>
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="text-sm truncate" style={{color:'#a1a1aa'}}>{course.description}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl p-3 text-center"
                      style={{background:'rgba(255,255,255,0.03)'}}>
                      <p className="text-lg font-bold gradient-text">₹{course.price.toLocaleString()}</p>
                      <p className="text-xs" style={{color:'#52525b'}}>Price</p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{background:'rgba(255,255,255,0.03)'}}>
                      <p className="text-lg font-bold text-white">{course.total_lessons}</p>
                      <p className="text-xs" style={{color:'#52525b'}}>Lessons</p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{background:'rgba(255,255,255,0.03)'}}>
                      <DeliveryIcon className="w-5 h-5 mx-auto mb-0.5" style={{color:'#8b5cf6'}} />
                      <p className="text-xs" style={{color:'#52525b'}}>{deliveryLabel[course.delivery]}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={`/dashboard/courses/${course.id}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{background:'rgba(124,58,237,0.15)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
                      <BookOpen className="w-4 h-4" />
                      Manage
                    </Link>
                    <Link href={`/c/${course.slug}`} target="_blank"
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                      style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
                      <ExternalLink className="w-4 h-4" />
                      Preview
                    </Link>
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