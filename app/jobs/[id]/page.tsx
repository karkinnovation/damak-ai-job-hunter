import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { ApplicationStatus } from '@/components/ApplicationStatus'
import { locationLabel } from '@/lib/location'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function formatEmploymentType(value?: string | null) {
  if (!value) return 'Not specified'

  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatTime(value?: string | null) {
  if (!value) return 'Not specified'

  return String(value).slice(0, 5)
}

function formatSalary(value?: number | null) {
  if (value === null || value === undefined) return 'Not specified'

  return `NPR ${Number(value).toLocaleString()}`
}

export default async function JobDetails({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  /*
   * Load only the fields required by this page.
   * Supabase may infer businesses(...) as either an object or an array,
   * so we normalize it below before using business_name.
   */
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      employer_id,
      business_id,
      title,
      description,
      category,
      salary_min,
      salary_max,
      employment_type,
      experience_required_months,
      education_requirement,
      working_start,
      working_end,
      number_of_openings,
      required_skills,
      preferred_skills,
      ward,
      city,
      district,
      province,
      latitude,
      longitude,
      status,
      created_at,
      businesses(
        business_name,
        business_type
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (jobError || !job) {
    notFound()
  }

  /*
   * Supabase can return the nested relation as:
   *
   * businesses: { ... }
   *
   * OR:
   *
   * businesses: [{ ... }]
   *
   * This safely handles both.
   */
  const business = Array.isArray(job.businesses)
    ? job.businesses[0]
    : job.businesses

  /*
   * Authentication is optional on the public job-details page.
   */
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  let role: string | null = null
  let seekerProfileExists = false

  let existingApplication: {
    id: string
    status: string
    distance_km: number | null
    created_at: string
  } | null = null

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    role = profile?.role ?? null

    if (role === 'job_seeker') {
      const [{ data: seeker }, { data: application }] = await Promise.all([
        supabase
          .from('job_seeker_profiles')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle(),

        supabase
          .from('applications')
          .select(`
            id,
            status,
            distance_km,
            created_at
          `)
          .eq('job_id', id)
          .eq('job_seeker_id', userId)
          .maybeSingle(),
      ])

      seekerProfileExists = Boolean(seeker)

      existingApplication = application
        ? {
            id: application.id,
            status: application.status,
            distance_km:
              application.distance_km === null
                ? null
                : Number(application.distance_km),
            created_at: application.created_at,
          }
        : null
    }
  }

  const requiredSkills = Array.isArray(job.required_skills)
    ? job.required_skills
    : []

  const preferredSkills = Array.isArray(job.preferred_skills)
    ? job.preferred_skills
    : []

  const isOpen = job.status === 'open'

  return (
    <section
      className="container"
      style={{
        paddingTop: '32px',
        paddingBottom: '64px',
      }}
    >
      {/* Back navigation */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/jobs"
          className="muted"
          style={{
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          ← Back to jobs
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
          gap: '24px',
          alignItems: 'start',
        }}
        className="jobDetailsLayout"
      >
        {/* LEFT / MAIN CONTENT */}
        <main style={{ minWidth: 0 }}>
          <div
            className="card"
            style={{
              padding: '26px',
              marginBottom: '18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '14px',
              }}
            >
              {job.category && (
                <span className="badge">
                  {job.category}
                </span>
              )}

              <span className="badge">
                {formatEmploymentType(job.employment_type)}
              </span>

              {!isOpen && (
                <span className="badge">
                  Closed
                </span>
              )}
            </div>

            <h1
              style={{
                marginTop: 0,
                marginBottom: '10px',
              }}
            >
              {job.title}
            </h1>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom: '18px',
                fontSize: '15px',
              }}
            >
              {business?.business_name || 'Local Employer'}
              {' · '}
              {locationLabel(job)}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                marginTop: '20px',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--surface-soft, #f7f9fb)',
                }}
              >
                <div
                  className="muted"
                  style={{ fontSize: '12px' }}
                >
                  Salary
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {job.salary_min !== null &&
                  job.salary_max !== null
                    ? `${formatSalary(job.salary_min)} – ${Number(
                        job.salary_max
                      ).toLocaleString()}`
                    : 'Not specified'}
                </strong>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--surface-soft, #f7f9fb)',
                }}
              >
                <div
                  className="muted"
                  style={{ fontSize: '12px' }}
                >
                  Employment
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {formatEmploymentType(job.employment_type)}
                </strong>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--surface-soft, #f7f9fb)',
                }}
              >
                <div
                  className="muted"
                  style={{ fontSize: '12px' }}
                >
                  Openings
                </div>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {job.number_of_openings ?? 1}
                </strong>
              </div>
            </div>
          </div>

          {/* Description */}
          <div
            className="card"
            style={{
              padding: '24px',
              marginBottom: '18px',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: '12px',
              }}
            >
              About this job
            </h2>

            <p
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {job.description || 'No description provided.'}
            </p>
          </div>

          {/* Skills */}
          <div
            className="card"
            style={{
              padding: '24px',
              marginBottom: '18px',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: '16px',
              }}
            >
              Skills
            </h2>

            <div style={{ marginBottom: '18px' }}>
              <strong
                style={{
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Required skills
              </strong>

              {requiredSkills.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  {requiredSkills.map(skill => (
                    <span
                      key={skill}
                      className="badge"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p
                  className="muted"
                  style={{ margin: 0 }}
                >
                  No specific required skills listed.
                </p>
              )}
            </div>

            {preferredSkills.length > 0 && (
              <div>
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Preferred skills
                </strong>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  {preferredSkills.map(skill => (
                    <span
                      key={skill}
                      className="badge"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div
            className="card"
            style={{
              padding: '24px',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: '16px',
              }}
            >
              Job requirements
            </h2>

            <div
              style={{
                display: 'grid',
                gap: '14px',
              }}
            >
              <div>
                <div
                  className="muted"
                  style={{ fontSize: '13px' }}
                >
                  Experience
                </div>

                <strong>
                  {job.experience_required_months
                    ? `${job.experience_required_months} month${
                        job.experience_required_months === 1
                          ? ''
                          : 's'
                      }`
                    : 'No previous experience required'}
                </strong>
              </div>

              <div>
                <div
                  className="muted"
                  style={{ fontSize: '13px' }}
                >
                  Education
                </div>

                <strong>
                  {job.education_requirement ||
                    'No specific education requirement'}
                </strong>
              </div>

              <div>
                <div
                  className="muted"
                  style={{ fontSize: '13px' }}
                >
                  Working hours
                </div>

                <strong>
                  {formatTime(job.working_start)}
                  {' – '}
                  {formatTime(job.working_end)}
                </strong>
              </div>

              <div>
                <div
                  className="muted"
                  style={{ fontSize: '13px' }}
                >
                  Workplace
                </div>

                <strong>
                  {locationLabel(job)}
                </strong>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT / APPLY SIDEBAR */}
        <aside
          className="card"
          style={{
            padding: '22px',
            position: 'sticky',
            top: '88px',
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: '6px',
            }}
          >
            Interested?
          </h2>

          <p
            className="muted"
            style={{
              marginTop: 0,
              lineHeight: 1.55,
            }}
          >
            Review the vacancy details before submitting your
            application.
          </p>

          {/* Already applied */}
          {existingApplication ? (
            <div
              style={{
                marginTop: '18px',
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(20, 184, 166, 0.06)',
                border:
                  '1px solid rgba(20, 184, 166, 0.18)',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                You already applied
              </strong>

              <ApplicationStatus
                status={existingApplication.status}
              />

              {existingApplication.distance_km !== null && (
                <p
                  className="muted"
                  style={{
                    marginBottom: 0,
                    marginTop: '10px',
                    fontSize: '13px',
                  }}
                >
                  Workplace distance:{' '}
                  <strong>
                    {existingApplication.distance_km.toFixed(1)} km
                  </strong>
                </p>
              )}

              <Link
                href="/seeker/applications"
                className="button secondary"
                style={{
                  marginTop: '14px',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                View my applications
              </Link>
            </div>
          ) : !signedIn(userId) ? (
            /*
             * Not logged in.
             */
            <div style={{ marginTop: '18px' }}>
              <Link
                href={`/auth?next=${encodeURIComponent(
                  `/jobs/${id}`
                )}`}
                className="button"
                style={{
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                Login to apply
              </Link>

              <p
                className="muted"
                style={{
                  fontSize: '12px',
                  marginBottom: 0,
                  marginTop: '10px',
                  textAlign: 'center',
                }}
              >
                Create a free job seeker account to apply.
              </p>
            </div>
          ) : role !== 'job_seeker' ? (
            /*
             * Employer/admin.
             */
            <div
              style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--surface-soft, #f7f9fb)',
              }}
            >
              <p
                className="muted"
                style={{ margin: 0 }}
              >
                Only job seeker accounts can apply for vacancies.
              </p>
            </div>
          ) : !seekerProfileExists ? (
            /*
             * Seeker exists but profile has not been completed.
             */
            <div style={{ marginTop: '18px' }}>
              <Link
                href="/seeker/profile"
                className="button"
                style={{
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                Complete profile first
              </Link>

              <p
                className="muted"
                style={{
                  fontSize: '12px',
                  marginBottom: 0,
                  marginTop: '10px',
                }}
              >
                Your profile is required so Awasar can calculate
                compatibility and travel distance.
              </p>
            </div>
          ) : !isOpen ? (
            <div
              style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--surface-soft, #f7f9fb)',
              }}
            >
              <strong>This vacancy is closed.</strong>
            </div>
          ) : (
            /*
             * Ready to apply.
             *
             * v8/v9 application flow uses the dedicated confirmation
             * page so distance, rate limits and low-match confirmation
             * can happen before insertion.
             */
            <div style={{ marginTop: '18px' }}>
              <Link
                href={`/jobs/${id}/apply`}
                className="button"
                style={{
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                Apply now
              </Link>

              <p
                className="muted"
                style={{
                  marginBottom: 0,
                  marginTop: '10px',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                You can review your match and travel distance before
                confirming.
              </p>
            </div>
          )}

          <hr
            style={{
              border: 0,
              borderTop: '1px solid rgba(0,0,0,0.08)',
              margin: '22px 0',
            }}
          />

          <div
            style={{
              display: 'grid',
              gap: '10px',
              fontSize: '13px',
            }}
          >
            <div>
              <span className="muted">Employer</span>

              <strong
                style={{
                  display: 'block',
                  marginTop: '2px',
                }}
              >
                {business?.business_name || 'Local Employer'}
              </strong>
            </div>

            {business?.business_type && (
              <div>
                <span className="muted">
                  Business type
                </span>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '2px',
                  }}
                >
                  {business.business_type}
                </strong>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

/*
 * Small helper purely for JSX readability.
 */
function signedIn(userId?: string | null) {
  return Boolean(userId)
}