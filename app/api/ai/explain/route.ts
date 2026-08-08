import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calculateMatch, fallbackExplanation } from '@/lib/matching'
import { explainMatch } from '@/lib/ai'

const requestSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid().optional(),
})

function matchInput(seeker: any, job: any) {
  return {
    seeker: {
      skills: seeker.skills || [],
      experience_months: seeker.experience_months,
      education_level: seeker.education_level,
      expected_salary_min: seeker.expected_salary_min,
      expected_salary_max: seeker.expected_salary_max,
      employment_type: seeker.employment_type,
      available_from: String(seeker.available_from).slice(0, 5),
      available_until: String(seeker.available_until).slice(0, 5),
      max_travel_km: Number(seeker.max_travel_km),
      latitude: seeker.latitude,
      longitude: seeker.longitude,
      ward: seeker.ward,
      preferred_categories: seeker.preferred_categories || [],
    },
    job: {
      required_skills: job.required_skills || [],
      preferred_skills: job.preferred_skills || [],
      experience_required_months: job.experience_required_months,
      education_requirement: job.education_requirement,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      employment_type: job.employment_type,
      working_start: String(job.working_start).slice(0, 5),
      working_end: String(job.working_end).slice(0, 5),
      latitude: job.latitude,
      longitude: job.longitude,
      ward: job.ward,
      category: job.category,
    },
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const audience: 'job_seeker' | 'employer' = profile.role === 'employer' ? 'employer' : 'job_seeker'
  const { jobId, candidateId } = parsed.data
  let candidate = userId
  let jobQuery = supabase.from('jobs').select('id,title,category,ward,salary_min,salary_max,employment_type,required_skills,preferred_skills,experience_required_months,education_requirement,working_start,working_end,latitude,longitude,employer_id,status').eq('id', jobId)

  if (profile.role === 'job_seeker') {
    if (candidateId && candidateId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    jobQuery = jobQuery.eq('status', 'open')
  } else if (profile.role === 'employer') {
    if (!candidateId) return NextResponse.json({ error: 'Candidate required' }, { status: 400 })
    candidate = candidateId
    jobQuery = jobQuery.eq('employer_id', userId)
    const { data: application } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_seeker_id', candidate)
      .maybeSingle()
    if (!application) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else {
    return NextResponse.json({ error: 'Unsupported role' }, { status: 403 })
  }

  const [{ data: job }, { data: seeker }] = await Promise.all([
    jobQuery.maybeSingle(),
    supabase.from('job_seeker_profiles').select('skills,experience_months,education_level,expected_salary_min,expected_salary_max,employment_type,available_from,available_until,max_travel_km,latitude,longitude,ward,preferred_categories').eq('user_id', candidate).maybeSingle(),
  ])
  if (!job || !seeker) return NextResponse.json({ error: 'Match data unavailable' }, { status: 404 })

  const breakdown = calculateMatch(matchInput(seeker, job))
  const fallback = fallbackExplanation(breakdown.score, breakdown.positives, breakdown.mismatches)

  const { data: cached } = audience === 'job_seeker'
    ? await supabase
        .from('match_results')
        .select('score,explanation,calculated_at')
        .eq('job_id', jobId)
        .eq('job_seeker_id', candidate)
        .maybeSingle()
    : { data: null }

  const freshEnough = cached?.calculated_at
    ? Date.now() - new Date(cached.calculated_at).getTime() < 12 * 60 * 60 * 1000
    : false

  if (audience === 'job_seeker' && cached && cached.score === breakdown.score && cached.explanation && freshEnough) {
    return NextResponse.json({ explanation: cached.explanation, cached: true })
  }

  const explanation = await explainMatch({
    audience,
    score: breakdown.score,
    breakdown,
    seeker: {
      skills: seeker.skills,
      experience_months: seeker.experience_months,
      education_level: seeker.education_level,
      expected_salary: [seeker.expected_salary_min, seeker.expected_salary_max],
      employment_type: seeker.employment_type,
      availability: [seeker.available_from, seeker.available_until],
      max_travel_km: seeker.max_travel_km,
      preferred_categories: seeker.preferred_categories,
    },
    job: {
      title: job.title,
      category: job.category,
      required_skills: job.required_skills,
      preferred_skills: job.preferred_skills,
      experience_required_months: job.experience_required_months,
      education_requirement: job.education_requirement,
      salary: [job.salary_min, job.salary_max],
      employment_type: job.employment_type,
      hours: [job.working_start, job.working_end],
      ward: job.ward,
    },
  })

  if (audience === 'job_seeker' && process.env.GEMINI_API_KEY && explanation !== fallback) {
    await supabase.from('match_results').upsert({
      job_id: jobId,
      job_seeker_id: candidate,
      score: breakdown.score,
      breakdown,
      explanation,
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'job_id,job_seeker_id' })
  }

  return NextResponse.json({ explanation, cached: false })
}
