import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { NEPAL_PROVINCES } from '@/lib/constants'
import { employerProfileSchema } from '@/lib/validation'
import { LocationPicker } from '@/components/LeafletMap'

async function saveBusiness(formData: FormData) {
  'use server'
  const { supabase, user } = await requireRole(['employer'])
  const parsed = employerProfileSchema.safeParse({
    full_name: formData.get('full_name'),
    business_name: formData.get('business_name'),
    business_type: formData.get('business_type'),
    city: formData.get('city'),
    district: formData.get('district'),
    province: formData.get('province'),
    ward: formData.get('ward'),
    phone: formData.get('phone'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  })
  if (!parsed.success) redirect('/employer/profile?error=' + encodeURIComponent(parsed.error.issues[0]?.message || 'Check the business location details.'))
  const d = parsed.data
  await supabase.from('profiles').update({ full_name: d.full_name }).eq('id', user.id)
  const { error } = await supabase.from('businesses').upsert({
    user_id:user.id, business_name:d.business_name, business_type:d.business_type,
    city:d.city, district:d.district, province:d.province, ward:d.ward,
    phone:d.phone, latitude:d.latitude, longitude:d.longitude
  }, { onConflict:'user_id' })
  if (error) redirect('/employer/profile?error=' + encodeURIComponent(error.message))
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export default async function EmployerProfile({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const { supabase, user, profile } = await requireRole(['employer'])
  const { data } = await supabase.from('businesses').select('id,business_name,business_type,ward,city,district,province,phone,latitude,longitude').eq('user_id', user.id).maybeSingle()
  const { error } = await searchParams
  return <section className="narrow">
    <span className="eyebrow">Employer profile · Nepal</span>
    <h1>Your business location</h1>
    <p className="muted">Awasar now supports employers anywhere in Nepal. Your workplace pin powers actual distance matching.</p>
    {error && <p className="error">{error}</p>}
    <form className="stack card" action={saveBusiness}>
      <div className="field"><label>Your name</label><input name="full_name" defaultValue={profile.full_name || ''} required /></div>
      <div className="field"><label>Business name</label><input name="business_name" defaultValue={data?.business_name || ''} required /></div>
      <div className="field"><label>Business type</label><input name="business_type" placeholder="e.g. Electronics shop" defaultValue={data?.business_type || ''} required /></div>
      <div className="field"><label>Province</label><select name="province" defaultValue={data?.province || ''} required><option value="" disabled>Select province</option>{NEPAL_PROVINCES.map(p => <option key={p}>{p}</option>)}</select></div>
      <div className="formGrid">
        <div className="field"><label>District</label><input name="district" placeholder="e.g. Jhapa" defaultValue={data?.district || ''} required /></div>
        <div className="field"><label>City / municipality</label><input name="city" placeholder="e.g. Damak" defaultValue={data?.city || ''} required /></div>
      </div>
      <div className="formGrid">
        <div className="field"><label>Ward number</label><input type="number" min="1" max="99" name="ward" defaultValue={data?.ward || 5} required /></div>
        <div className="field"><label>Phone</label><input name="phone" defaultValue={data?.phone || ''} required /></div>
      </div>
      <LocationPicker latitude={data?.latitude != null ? Number(data.latitude) : null} longitude={data?.longitude != null ? Number(data.longitude) : null} label={data?.business_name ? `${data.business_name} workplace` : 'Workplace location'} liveLabelInputName="business_name" />
      <button className="button">Save business profile</button>
    </form>
  </section>
}
