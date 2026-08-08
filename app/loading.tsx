export default function Loading() {
  return (
    <div className="routeLoading" role="status" aria-live="polite" aria-label="Loading page">
      <div className="routeLoadingBar" aria-hidden="true" />
      <div className="skeleton routeLoadingHero">Loading…</div>
      <div className="routeLoadingGrid" aria-hidden="true">
        <div className="skeleton routeLoadingCard" />
        <div className="skeleton routeLoadingCard" />
        <div className="skeleton routeLoadingCard" />
      </div>
    </div>
  )
}
