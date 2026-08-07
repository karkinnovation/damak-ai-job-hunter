import { fallbackExplanation, type MatchBreakdown } from '@/lib/matching'

type ExplainArgs = {
  score: number
  breakdown: MatchBreakdown
  seeker: Record<string, unknown>
  job: Record<string, unknown>
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

const SYSTEM_INSTRUCTION = `You explain job compatibility for a local employment platform in Damak, Nepal.
The numeric suitability score is already calculated by a deterministic matching engine. Never recalculate, round, increase, decrease, or contradict it.
Use 2-4 short sentences in plain English. Mention the strongest matching factors and the most important mismatch when one exists.
Never infer sensitive personal traits. Never promise a job, automatically reject a candidate, or make the final hiring decision.`

export async function explainMatch({ score, breakdown, seeker, job }: ExplainArgs) {
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
            parts: [{ text: SYSTEM_INSTRUCTION }],
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
