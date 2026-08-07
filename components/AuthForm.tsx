'use client'

import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ defaultRole, initialError }: { defaultRole: 'job_seeker'|'employer'; initialError?: string }) {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [error, setError] = useState(initialError || '')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') || '').trim()
    const password = String(fd.get('password') || '')
    const full_name = String(fd.get('full_name') || '').trim()
    const role = String(fd.get('role') || defaultRole)

    if (!email || password.length < 8) {
      setError('Use a valid email and a password of at least 8 characters.')
      setLoading(false)
      return
    }

    if (mode === 'register') {
      if (full_name.length < 2 || !['job_seeker', 'employer'].includes(role)) {
        setError('Please complete your name and role.')
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name, role }, emailRedirectTo: `${window.location.origin}/auth/confirm` },
      })
      if (error) setError(error.message)
      else if (data.session) window.location.replace('/dashboard')
      else setSuccess('Account created. Check your email to confirm your address, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else window.location.replace('/dashboard')
    }

    setLoading(false)
  }

  return <div className="card authCard">
    <span className="eyebrow">Damak Job Hunter</span>
    <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
    <p className="muted">{mode === 'login' ? 'Sign in to continue to your local job dashboard.' : 'Choose your role and start matching with local opportunities.'}</p>
    {error && <p className="error">{error}</p>}
    {success && <p className="success">{success}</p>}
    <form className="stack" onSubmit={submit}>
      {mode === 'register' && <>
        <div className="field"><label>Full name</label><input name="full_name" maxLength={80} autoComplete="name" required /></div>
        <div className="field"><label>I am a</label><select name="role" defaultValue={defaultRole}><option value="job_seeker">Job Seeker</option><option value="employer">Employer</option></select></div>
      </>}
      <div className="field"><label>Email</label><input type="email" name="email" autoComplete="email" required /></div>
      <div className="field"><label>Password</label><input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></div>
      <button className="button full" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button>
    </form>
    <p className="muted authSwitch">{mode === 'login' ? 'New here?' : 'Already registered?'} <button className="linkButton" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}><b>{mode === 'login' ? 'Create account' : 'Login'}</b></button></p>
  </div>
}
