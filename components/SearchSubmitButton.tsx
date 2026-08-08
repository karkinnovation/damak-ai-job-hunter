'use client'

type Props = {
  className?: string
  label?: string
}

/*
 * Keep this button intentionally simple.
 *
 * The previous version called setPending(true) from onClick and immediately
 * disabled the submit button. In React/browser event timing that can stop the
 * form's default submit action, leaving the button stuck on "Searching…".
 *
 * Navigation feedback is already handled by app/loading.tsx, so the safest and
 * fastest behaviour here is a normal native GET-form submit.
 */
export default function SearchSubmitButton({
  className = 'button searchButton',
  label = 'Find jobs',
}: Props) {
  return (
    <button className={className} type="submit">
      {label}
    </button>
  )
}
