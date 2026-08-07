import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'job_seeker' | 'employer' | 'admin'

export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  if (error || !id) redirect('/auth')
  return { supabase, user: { id } }
}

export async function requireRole(allowed: AppRole[]) {
  const { supabase, user } = await requireUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowed.includes(profile.role as AppRole)) redirect('/dashboard')
  return { supabase, user, profile }
}
