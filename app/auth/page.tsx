import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { createClient } from '@/lib/supabase/server'

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string }> }) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (claimsData?.claims?.sub) redirect('/dashboard')

  const params = await searchParams
  const defaultRole = params.role === 'employer' ? 'employer' : 'job_seeker'
  const initialError = params.error === 'confirmation_failed' ? 'Email confirmation failed or expired. Please try again.' : undefined
  return <section className="authPage"><div className="authWrap"><div className="authIntro"><span className="eyebrow">Local matching, not endless searching</span><h2>One profile. Better-fit jobs.</h2><p>Match on skills, salary, experience, availability and location—then understand exactly why a vacancy fits.</p><div className="authPoints"><span>✓ Damak-first vacancies</span><span>✓ Explainable match scores</span><span>✓ Employer candidate ranking</span></div></div><AuthForm defaultRole={defaultRole} initialError={initialError} /></div></section>
}
