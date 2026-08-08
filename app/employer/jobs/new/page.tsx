import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { COMMON_SKILLS, JOB_CATEGORIES } from '@/lib/constants'
import { jobSchema } from '@/lib/validation'

async function createJob(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['employer'])
  const { data: business } = await supabase.from('businesses').select('*').eq('user_id', user.id).maybeSingle()
  if (!business) redirect('/employer/profile?error=' + encodeURIComponent('Create your business profile before posting a vacancy.'))

  const parsed = jobSchema.safeParse({
    title: formData.get('title'), description: formData.get('description'), category: formData.get('category'), ward: formData.get('ward'),
    salary_min: formData.get('salary_min'), salary_max: formData.get('salary_max'), employment_type: formData.get('employment_type'),
    experience_required_months: formData.get('experience_required_months'), education_requirement: formData.get('education_requirement') || '',
    working_start: formData.get('working_start'), working_end: formData.get('working_end'), number_of_openings: formData.get('number_of_openings'),
    latitude: formData.get('latitude') || undefined, longitude: formData.get('longitude') || undefined,
    required_skills: formData.getAll('required_skills').map(String), preferred_skills: formData.getAll('preferred_skills').map(String),
  })
  if (!parsed.success) redirect('/employer/jobs/new?error=' + encodeURIComponent(parsed.error.issues[0]?.message || 'Invalid data'))
  const d = parsed.data
  const { error } = await supabase.from('jobs').insert({
    employer_id:user.id, business_id:business.id, title:d.title, description:d.description, category:d.category, ward:d.ward, city:'Damak',
    salary_min:d.salary_min, salary_max:d.salary_max, employment_type:d.employment_type, experience_required_months:d.experience_required_months,
    education_requirement:d.education_requirement || null, working_start:d.working_start, working_end:d.working_end, number_of_openings:d.number_of_openings,
    latitude:d.latitude ?? business.latitude ?? null, longitude:d.longitude ?? business.longitude ?? null,
    required_skills:d.required_skills, preferred_skills:d.preferred_skills, status:'open',
  })
  if (error) redirect('/employer/jobs/new?error=' + encodeURIComponent(error.message))
  revalidatePath('/jobs'); revalidatePath('/employer/jobs'); redirect('/employer/jobs')
}

export default async function NewJob({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const { supabase, user } = await requireRole(['employer'])
  const { data: business } = await supabase.from('businesses').select('*').eq('user_id', user.id).maybeSingle()
  const { error } = await searchParams
  return <section className="narrow"><span className="eyebrow">Employer · New vacancy</span><h1>Post a local job</h1><p className="muted">Only ask for requirements that genuinely matter; they directly affect candidate rankings.</p>
    {!business && <p className="notice">Create your business profile first. <a href="/employer/profile"><b>Open profile →</b></a></p>}{error && <p className="error">{error}</p>}
    <form className="stack card" action={createJob}>
      <div className="field"><label>Job title</label><input name="title" placeholder="e.g. Account Assistant" required /></div>
      <div className="field"><label>Description</label><textarea name="description" placeholder="Main duties, expectations and useful context…" required /></div>
      <div className="formGrid"><div className="field"><label>Category</label><select name="category">{JOB_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div><div className="field"><label>Damak ward</label><input type="number" name="ward" min="1" max="10" defaultValue={business?.ward || 5} required /></div></div>
      <div className="formGrid"><div className="field"><label>Salary min (NPR)</label><input type="number" name="salary_min" defaultValue="18000" required /></div><div className="field"><label>Salary max (NPR)</label><input type="number" name="salary_max" defaultValue="25000" required /></div></div>
      <div className="formGrid"><div className="field"><label>Employment type</label><select name="employment_type"><option value="full_time">Full Time</option><option value="part_time">Part Time</option></select></div><div className="field"><label>Experience required (months)</label><input type="number" min="0" name="experience_required_months" defaultValue="0" required /></div></div>
      <div className="field"><label>Education requirement (optional)</label><input name="education_requirement" placeholder="e.g. +2 Management" /></div>
      <div className="formGrid"><div className="field"><label>Working start</label><input type="time" name="working_start" defaultValue="09:00" required /></div><div className="field"><label>Working end</label><input type="time" name="working_end" defaultValue="17:00" required /></div></div>
      <div className="field"><label>Number of openings</label><input type="number" min="1" max="100" name="number_of_openings" defaultValue="1" required /></div>
      <div className="field"><label>Required skills</label><div className="checks">{COMMON_SKILLS.map(s => <label className="check" key={s}><input type="checkbox" name="required_skills" value={s}/>{s}</label>)}</div></div>
      <div className="field"><label>Preferred / bonus skills</label><div className="checks">{COMMON_SKILLS.map(s => <label className="check" key={s}><input type="checkbox" name="preferred_skills" value={s}/>{s}</label>)}</div></div>
      <details><summary>Optional job coordinates (defaults to business coordinates)</summary><div className="formGrid" style={{marginTop:12}}><div className="field"><label>Latitude</label><input type="number" step="any" name="latitude" /></div><div className="field"><label>Longitude</label><input type="number" step="any" name="longitude" /></div></div></details>
      <button className="button" disabled={!business}>Publish vacancy</button>
    </form>
  </section>
}
