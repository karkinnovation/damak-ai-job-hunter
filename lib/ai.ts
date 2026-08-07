import { fallbackExplanation, type MatchBreakdown } from '@/lib/matching'

type ExplainArgs = {
  score: number
  breakdown: MatchBreakdown
  seeker: Record<string, unknown>
  job: Record<string, unknown>
}

export async function explainMatch({ score, breakdown, seeker, job }: ExplainArgs) {
  const fallback = fallbackExplanation(score, breakdown.positives, breakdown.mismatches)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallback

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        instructions: 'You explain job compatibility for a local employment platform in Damak, Nepal. Never recalculate or change the provided score. Do not make hiring decisions. Use 2-4 short sentences. Mention strongest matches and important mismatches. Avoid sensitive-trait inferences.',
        input: JSON.stringify({ score, positives: breakdown.positives, mismatches: breakdown.mismatches, seeker, job }),
        max_output_tokens: 180,
        store: false,
      }),
      cache: 'no-store',
    })
    if (!response.ok) return fallback
    const json = await response.json() as { output_text?: string }
    return json.output_text?.trim() || fallback
  } catch {
    return fallback
  }
}
