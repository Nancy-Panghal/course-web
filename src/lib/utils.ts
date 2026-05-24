import { SupabaseClient } from '@supabase/supabase-js'

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Gets the next sequential order number for a lesson in a course.
 * Uses COUNT of lessons instead of MAX to prevent gaps.
 * @param supabase - Supabase client
 * @param courseId - Course ID to get next order for
 * @returns Next order number (starts from 1)
 */
export async function getNextLessonOrder(
  supabase: SupabaseClient<any>,
  courseId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)

  if (error) {
    console.error('Error getting lesson count:', error)
    return 1
  }

  return (count || 0) + 1
}

/**
 * Renumbers all lessons for a course sequentially from 1.
 * Called after deleting a lesson to fill gaps.
 * @param supabase - Supabase client
 * @param courseId - Course ID to renumber
 */
export async function renumberLessons(
  supabase: SupabaseClient<any>,
  courseId: string
): Promise<void> {
  // Get all lessons ordered by current order_num
  const { data: lessons, error: fetchError } = await supabase
    .from('lessons')
    .select('id, order_num')
    .eq('course_id', courseId)
    .order('order_num', { ascending: true })

  if (fetchError || !lessons) {
    console.error('Error fetching lessons:', fetchError)
    return
  }

  // Update each lesson with its correct sequential number
  for (let i = 0; i < lessons.length; i++) {
    const newOrder = i + 1
    if (lessons[i].order_num !== newOrder) {
      await supabase
        .from('lessons')
        .update({ order_num: newOrder })
        .eq('id', lessons[i].id)
    }
  }
}

/**
 * Gets the next sequential order number for a module in a course.
 * Uses COUNT instead of MAX to prevent gaps.
 * @param supabase - Supabase client
 * @param courseId - Course ID to get next order for
 * @returns Next order number (starts from 1)
 */
export async function getNextModuleOrder(
  supabase: SupabaseClient<any>,
  courseId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('course_modules')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)

  if (error) {
    console.error('Error getting module count:', error)
    return 1
  }

  return (count || 0) + 1
}

/**
 * Renumbers all modules for a course sequentially from 1.
 * Called after deleting a module to fill gaps.
 * @param supabase - Supabase client
 * @param courseId - Course ID to renumber
 */
export async function renumberModules(
  supabase: SupabaseClient<any>,
  courseId: string
): Promise<void> {
  // Get all modules ordered by current order_num
  const { data: modules, error: fetchError } = await supabase
    .from('course_modules')
    .select('id, order_num')
    .eq('course_id', courseId)
    .order('order_num', { ascending: true })

  if (fetchError || !modules) {
    console.error('Error fetching modules:', fetchError)
    return
  }

  // Update each module with its correct sequential number
  for (let i = 0; i < modules.length; i++) {
    const newOrder = i + 1
    if (modules[i].order_num !== newOrder) {
      await supabase
        .from('course_modules')
        .update({ order_num: newOrder })
        .eq('id', modules[i].id)
    }
  }
}
