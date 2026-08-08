const STATUS_COPY = {
  applied: {
    label: 'Applied',
    detail: 'Your application has been submitted to the employer.',
    step: 1,
  },
  reviewed: {
    label: 'Reviewed',
    detail: 'The employer has reviewed your application.',
    step: 2,
  },
  shortlisted: {
    label: 'Shortlisted',
    detail: 'You have been shortlisted for the next hiring step.',
    step: 3,
  },
  rejected: {
    label: 'Not selected',
    detail: 'The employer decided not to move forward with this application.',
    step: 4,
  },
} as const

export type ApplicationStatusValue = keyof typeof STATUS_COPY

export function applicationStatusCopy(status: string) {
  return STATUS_COPY[status as ApplicationStatusValue] || {
    label: status || 'Unknown',
    detail: 'Application status updated.',
    step: 1,
  }
}

export function ApplicationStatus({ status, compact = false }: { status: string; compact?: boolean }) {
  const info = applicationStatusCopy(status)
  const safeStatus = STATUS_COPY[status as ApplicationStatusValue] ? status : 'applied'

  if (compact) {
    return <span className={`applicationStatus status-${safeStatus}`}>{info.label}</span>
  }

  const steps = ['Applied', 'Reviewed', 'Shortlisted']
  const currentStep = status === 'rejected' ? 2 : info.step

  return (
    <div className="applicationStatusPanel">
      <div className="applicationStatusHead">
        <span className={`applicationStatus status-${safeStatus}`}>{info.label}</span>
        <span className="muted statusDetail">{info.detail}</span>
      </div>
      <div className="statusTrack" aria-label={`Application status: ${info.label}`}>
        {steps.map((label, index) => {
          const step = index + 1
          const done = step <= currentStep && status !== 'rejected'
          const active = step === currentStep && status !== 'rejected'
          return (
            <div className={`statusStep ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={label}>
              <span className="statusDot">{done ? '✓' : step}</span>
              <span>{label}</span>
            </div>
          )
        })}
      </div>
      {status === 'rejected' && <p className="statusRejectedNote">This application is closed. You can keep exploring other matching vacancies.</p>}
    </div>
  )
}
