import { supabase } from './supabase'

export async function ensureCreatorProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if creator profile exists
  const { data: existing } = await supabase
    .from('creators')
    .select('*')
    .eq('id', user.id)
    .single()

  if (existing) return existing

  // Create new creator profile
  const { data, error } = await supabase
    .from('creators')
    .insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.username || '',
      username: user.user_metadata?.username || user.email?.split('@')[0],
      plan: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  return data
}

export async function getCreatorProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('creators')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export function getTrialStatus(creator: any) {
  if (!creator) return { expired: false, daysLeft: 30 }
  const trialEnd = new Date(creator.trial_ends_at)
  const now = new Date()
  const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return {
    expired: daysLeft <= 0,
    daysLeft: Math.max(0, daysLeft),
    plan: creator.plan,
  }
}