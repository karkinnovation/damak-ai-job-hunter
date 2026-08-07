import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { employerProfileSchema } from '@/lib/validation'

async function saveBusiness(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['employer'])
  const parsed = employerProfileSchema.safeParse({
    full_name: formData.get('full_name'), business_name: formData.get('business_name'), business_type: formData.get('business_type'), ward: formData.get('ward'), phone: formData.get('phone'),
    latitude: formData.get('latitude') || undefined, longitude: formData.get('longitude') || undefined,
  })
  if (!parsed.success) redirect('/employer/profile?error=' + encodeURIComponent(parsed.error.issues[0]?.message || 'Invalid data'))
  const d = parsed.data
  await supabase.from('profiles').update({ full_name: d.full_name }).eq('id', user.id)
  const { error } = await supabase.from('businesses').upsert({ user_id:user.id, business_name:d.business_name, business_type:d.business_type, ward:d.ward, city:'Damak', phone:d.phone, latitude:d.latitude ?? null, longitude:d.longitude ?? null }, { onConflict:'user_id' })
  if (error) redirect('/employer/profile?error=' + encodeURIComponent(error.message))
  revalidatePath('/dashboard'); redirect('/dashboard')
}

export default async function EmployerProfile({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const { supabase, user, profile } = await requireRole(['employer'])
  const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).maybeSingle()
  const { error } = await searchParams
  return <section className="narrow"><span className="eyebrow">Employer profile</span><h1>Your local business</h1><p className="muted">Basic information shown with your vacancies.</p>{error && <p className="error">{error}</p>}
    <form className="stack card" action={saveBusiness}>
      <div className="field"><label>Your name</label><input name="full_name" defaultValue={profile.full_name || ''} required /></div>
      <div className="field"><label>Business name</label><input name="business_name" defaultValue={data?.business_name || ''} required /></div>
      <div className="formGrid"><div className="field"><label>Business type</label><input name="business_type" placeholder="e.g. Electronics shop" defaultValue={data?.business_type || ''} required /></div><div className="field"><label>Damak ward</label><input type="number" min="1" max="10" name="ward" defaultValue={data?.ward || 5} required /></div></div>
      <div className="field"><label>Phone</label><input name="phone" defaultValue={data?.phone || ''} required /></div>
      <details><summary>Optional precise workplace coordinates</summary><div className="formGrid" style={{marginTop:12}}><div className="field"><label>Latitude</label><input type="number" step="any" name="latitude" defaultValue={data?.latitude ?? ''}/></div><div className="field"><label>Longitude</label><input type="number" step="any" name="longitude" defaultValue={data?.longitude ?? ''}/></div></div></details>
      <button className="button">Save business profile</button>
    </form>
  </section>
}
