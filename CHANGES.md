# What changed

## Public job search
The homepage now focuses on title/company search, category, skill, and minimum salary. The ward selector was removed from the search UI based on feedback, while each vacancy still displays its Damak ward.

Popular category chips behave like search filters. Clicking one reloads the results for that category, scrolls to the vacancy section, and highlights the selected category.

## Application tracking
Job seekers can now clearly see employer-updated application state:

1. Applied — application submitted.
2. Reviewed — employer reviewed it.
3. Shortlisted — selected for the next step.
4. Not selected — employer closed the application.

Status is visible on the dashboard, My Applications, and job details after applying.

## Profile status fix
The dashboard checks `job_seeker_profiles.user_id`, which is the actual primary identifier in the supplied schema, instead of querying a non-existent `id` field.
