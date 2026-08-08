import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const patternKey = typeof body?.patternKey === 'string' ? body.patternKey.trim().slice(0, 160) : ''
  if (!patternKey) return NextResponse.json({ error: 'Invalid pattern' }, { status: 400 })

  const { error } = await supabase.from('application_nudge_dismissals').upsert({
    job_seeker_id: user.id,
    pattern_key: patternKey,
    dismissed_at: new Date().toISOString(),
  }, { onConflict: 'job_seeker_id,pattern_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
