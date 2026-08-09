import { fallbackExplanation, type MatchBreakdown } from '@/lib/matching'

type ExplainArgs = {
  score: number
  breakdown: MatchBreakdown
  seeker: Record<string, unknown>
  job: Record<string, unknown>
  audience?: 'job_seeker' | 'employer'
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

const BASE_INSTRUCTION = `You explain job compatibility for a employment platform across Nepal.
The numeric suitability score is already calculated by a deterministic matching engine. Never recalculate, round, increase, decrease, or contradict it.
Use 2-4 short sentences in plain English. Mention the strongest matching factors and the most important mismatch when one exists.
Never infer sensitive personal traits. Never promise a job, automatically reject a candidate, or make the final hiring decision.`

function systemInstruction(audience: 'job_seeker' | 'employer') {
  if (audience === 'employer') {
    return `${BASE_INSTRUCTION}
You are speaking to the employer about an applicant. Refer to the applicant as “the candidate” or “this candidate”. Never describe the employer as the job seeker. Never say “your skills”, “your experience”, “your salary expectation”, “your availability”, or “your travel preference” when those details belong to the candidate.`
  }

  return `${BASE_INSTRUCTION}
You are speaking directly to the job seeker. You may use “you” and “your” for the job seeker's own profile and preferences.`
}

export async function explainMatch({ score, breakdown, seeker, job, audience = 'job_seeker' }: ExplainArgs) {
  const fallback = fallbackExplanation(score, breakdown.positives, breakdown.mismatches)
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return fallback

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction(audience) }],
          },
          contents: [{
            role: 'user',
            parts: [{
              text: JSON.stringify({
                score,
                positives: breakdown.positives,
                mismatches: breakdown.mismatches,
                seeker,
                job,
              }),
            }],
          }],
          generationConfig: {
            maxOutputTokens: 180,
            thinkingConfig: { thinkingBudget: 0 },
          },
          store: false,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!response.ok) return fallback

    const json = await response.json() as GeminiResponse
    const text = json.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim()

    return text || fallback
  } catch {
    return fallback
  }
}
