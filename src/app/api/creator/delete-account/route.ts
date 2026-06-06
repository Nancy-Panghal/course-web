import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    // 1. Verify the requesting user via their session token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const creatorId = user.id

    // 2. Get all course IDs belonging to this creator
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id')
      .eq('creator_id', creatorId)

    if (coursesError) throw coursesError

    const courseIds = (courses || []).map(c => c.id)

    // 3. Delete in correct FK-safe order (children before parents)
    if (courseIds.length > 0) {
      // lesson_access_logs
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id')
        .in('course_id', courseIds)
      
      const lessonIds = (lessons || []).map(l => l.id)
      
      if (lessonIds.length > 0) {
        await supabase
          .from('lesson_access_logs')
          .delete()
          .in('lesson_id', lessonIds)
      }

      // email_logs
      await supabase
        .from('email_logs')
        .delete()
        .eq('creator_id', creatorId)

      // telegram_tokens
      await supabase
        .from('telegram_tokens')
        .delete()
        .eq('creator_id', creatorId)

      // coupons
      await supabase
        .from('coupons')
        .delete()
        .eq('creator_id', creatorId)

      // payments
      await supabase
        .from('payments')
        .delete()
        .eq('creator_id', creatorId)

      // enrollments
      await supabase
        .from('enrollments')
        .delete()
        .eq('creator_id', creatorId)

      // lessons
      await supabase
        .from('lessons')
        .delete()
        .in('course_id', courseIds)

      // course_modules
      await supabase
        .from('course_modules')
        .delete()
        .in('course_id', courseIds)

      // courses
      await supabase
        .from('courses')
        .delete()
        .eq('creator_id', creatorId)
    }

    // 4. Delete piracy_log if table exists
    await supabase
      .from('piracy_log')
      .delete()
      .eq('creator_id', creatorId)

    // 5. Delete creator profile
    await supabase
      .from('creators')
      .delete()
      .eq('id', creatorId)

    // 6. Delete the auth user — must be last, requires service role
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(creatorId)
    if (deleteUserError) throw deleteUserError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[creator/delete-account]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to delete account' },
      { status: 500 }
    )
  }
}