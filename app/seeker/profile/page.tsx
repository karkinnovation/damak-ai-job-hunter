import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { COMMON_SKILLS, JOB_CATEGORIES, NEPAL_PROVINCES } from '@/lib/constants'
import { seekerProfileSchema } from '@/lib/validation'
import { LocationPicker } from '@/components/LeafletMap'

async function saveProfile(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['job_seeker'])
  const raw = {
    full_name: formData.get('full_name'),
    city: formData.get('city'),
    district: formData.get('district'),
    province: formData.get('province'),
    ward: formData.get('ward'),
    education_level: formData.get('education_level'),
    experience_months: formData.get('experience_months'),
    expected_salary_min: formData.get('expected_salary_min'),
    expected_salary_max: formData.get('expected_salary_max'),
    employment_type: formData.get('employment_type'),
    available_from: formData.get('available_from'),
    available_until: formData.get('available_until'),
    max_travel_km: formData.get('max_travel_km'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    show_availability_to_employers: formData.get('show_availability_to_employers') === 'on',
    preferred_categories: formData.getAll('preferred_categories').map(String),
    skills: formData.getAll('skills').map(String),
  }
  const parsed = seekerProfileSchema.safeParse(raw)
  if (!parsed.success) redirect('/seeker/profile?error=' + encodeURIComponent(parsed.error.issues[0]?.message || 'Invalid data'))
  const d = parsed.data
  await supabase.from('profiles').update({ full_name: d.full_name }).eq('id', user.id)
  const { error } = await supabase.from('job_seeker_profiles').upsert({
    user_id: user.id,
    city: d.city,
    district: d.district,
    province: d.province,
    ward: d.ward,
    education_level: d.education_level,
    experience_months: d.experience_months,
    expected_salary_min: d.expected_salary_min,
    expected_salary_max: d.expected_salary_max,
    employment_type: d.employment_type,
    available_from: d.available_from,
    available_until: d.available_until,
    max_travel_km: d.max_travel_km,
    latitude: d.latitude,
    longitude: d.longitude,
    show_availability_to_employers: d.show_availability_to_employers,
    preferred_categories: d.preferred_categories,
    skills: d.skills,
  }, { onConflict: 'user_id' })
  if (error) redirect('/seeker/profile?error=' + encodeURIComponent(error.message))
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export default async function SeekerProfile({ searchParams }: { searchParams: Promise<{error?: string}> }) {
  const { supabase, user, profile } = await requireRole(['job_seeker'])
  const { data } = await supabase.from('job_seeker_profiles')
    .select('user_id,city,district,province,ward,education_level,experience_months,expected_salary_min,expected_salary_max,employment_type,available_from,available_until,max_travel_km,latitude,longitude,skills,preferred_categories,show_availability_to_employers')
    .eq('user_id', user.id).maybeSingle()
  const { error } = await searchParams
  const selectedSkills: string[] = data?.skills || []
  const selectedCategories: string[] = data?.preferred_categories || []

  return <section className="narrow">
    <span className="eyebrow">Job seeker profile · Nepal</span>
    <h1>What kind of job fits you?</h1>
    <p className="muted">Set your location anywhere in Nepal. Your exact map pin is used for distance matching but stays private in anonymous employer browsing.</p>
    {error && <p className="error">{error}</p>}
    <form className="stack card" action={saveProfile}>
      <div className="field"><label>Full name</label><input name="full_name" defaultValue={profile.full_name || ''} required /></div>

      <div className="field">
        <label>Province</label>
        <select name="province" defaultValue={data?.province || ''} required><option value="" disabled>Select province</option>
          {NEPAL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="formGrid">
        <div className="field"><label>District</label><input name="district" placeholder="e.g. Jhapa, Morang, Kathmandu" defaultValue={data?.district || ''} required /></div>
        <div className="field"><label>City / municipality</label><input name="city" placeholder="e.g. Damak, Birtamode, Kathmandu" defaultValue={data?.city || ''} required /></div>
      </div>
      <div className="formGrid">
        <div className="field"><label>Ward number</label><input type="number" name="ward" min="1" max="99" defaultValue={data?.ward || 5} required /></div>
        <div className="field"><label>Education</label><input name="education_level" placeholder="e.g. +2 Management" defaultValue={data?.education_level || ''} required /></div>
      </div>

      <div className="formGrid"><div className="field"><label>Experience (months)</label><input type="number" min="0" name="experience_months" defaultValue={data?.experience_months ?? 0} required /></div><div className="field"><label>Max travel distance (km)</label><input type="number" step="0.5" min="0.5" name="max_travel_km" defaultValue={data?.max_travel_km ?? 5} required /></div></div>
      <div className="formGrid"><div className="field"><label>Expected salary minimum (NPR)</label><input type="number" name="expected_salary_min" defaultValue={data?.expected_salary_min ?? 15000} required /></div><div className="field"><label>Expected salary maximum (NPR)</label><input type="number" name="expected_salary_max" defaultValue={data?.expected_salary_max ?? 25000} required /></div></div>
      <div className="formGrid"><div className="field"><label>Employment preference</label><select name="employment_type" defaultValue={data?.employment_type || 'full_time'}><option value="full_time">Full Time</option><option value="part_time">Part Time</option></select></div><div className="field"><label>Available from</label><input type="time" name="available_from" defaultValue={(data?.available_from || '09:00').slice(0,5)} required /></div></div>
      <div className="field"><label>Available until</label><input type="time" name="available_until" defaultValue={(data?.available_until || '18:00').slice(0,5)} required /></div>
      <div className="field"><label>Skills</label><div className="checks">{COMMON_SKILLS.map(s => <label className="check" key={s}><input type="checkbox" name="skills" value={s} defaultChecked={selectedSkills.includes(s)} />{s}</label>)}</div></div>
      <div className="field"><label>Preferred job categories</label><div className="checks">{JOB_CATEGORIES.map(c => <label className="check" key={c}><input type="checkbox" name="preferred_categories" value={c} defaultChecked={selectedCategories.includes(c)} />{c}</label>)}</div></div>

      <LocationPicker latitude={data?.latitude != null ? Number(data.latitude) : null} longitude={data?.longitude != null ? Number(data.longitude) : null} label="Home location" />

      <div className="broadcastToggle">
        <label className="toggleRow">
          <input type="checkbox" name="show_availability_to_employers" defaultChecked={Boolean(data?.show_availability_to_employers)} />
          <span><strong>Show my availability to employers</strong><small>Employers can see an anonymous card with your skills, salary range, hours, city/district and travel radius. Your name, phone and exact map location remain hidden until you apply.</small></span>
        </label>
      </div>
      <button className="button">Save profile</button>
    </form>
  </section>
}
