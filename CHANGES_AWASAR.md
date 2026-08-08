# Awasar UI/Product Update

This build implements the feedback from the provided chat screenshot.

## What changed

- Brand changed from **Damak Job Hunter** to the single-word Nepali brand **अवसर (Awasar)**.
- Homepage is now job-specific instead of a generic marketing landing page.
- Open vacancies are visible directly on the homepage.
- Homepage search supports:
  - job title / skill / company keyword
  - job category
  - Damak ward
- Added quick popular-category filters.
- `/jobs` now has the same search/filter experience for consistency.
- AI remains the core differentiator, but the user-facing wording is more professional: **AI Match / Find My Best Matches**.
- Navigation now treats an authenticated session as logged in even if the profile query is temporarily unavailable, preventing the UI from incorrectly showing **Login / Register** after successful login.
- Mobile layouts were updated for the new search and vacancy cards.

## Core positioning

**अवसर — सही काम, सही अवसर.**

The platform works like a normal job site first, then adds intelligent compatibility ranking when a seeker wants help choosing the best-fit vacancy.
