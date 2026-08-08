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
  return <section className="authPage"><div className="authWrap"><div className="authIntro"><span className="eyebrow">सही काम, सही अवसर</span><h2>Search normally. Match intelligently.</h2><p>Browse vacancies like a normal job site, then use smart matching when you want jobs ranked by skills, salary, experience, availability and location.</p><div className="authPoints"><span>✓ Local vacancy search</span><span>✓ Explainable compatibility scores</span><span>✓ Employer candidate ranking</span></div></div><AuthForm defaultRole={defaultRole} initialError={initialError} /></div></section>
}
