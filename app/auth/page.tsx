import { AuthForm } from '@/components/AuthForm'

export default async function AuthPage({ searchParams }: { searchParams: Promise<{role?: string; error?: string}> }) {
  const params = await searchParams
  const defaultRole = params.role === 'employer' ? 'employer' : 'job_seeker'
  const initialError = params.error === 'confirmation_failed' ? 'Email confirmation failed or expired. Please try again.' : undefined
  return <section className="narrow"><AuthForm defaultRole={defaultRole} initialError={initialError}/></section>
}
