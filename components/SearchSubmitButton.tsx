type Props = {
  className?: string
  label?: string
}

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
