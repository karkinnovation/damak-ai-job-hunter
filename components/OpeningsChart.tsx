import type { MonthPoint } from '@/lib/demoInsights'

/*
 * Hand-rolled SVG chart rather than a charting library: the whole thing is a
 * dozen rects, and pulling in Recharts (~90kb) to draw them would be the
 * single heaviest thing on the page for users on Nepali mobile data.
 *
 * Server-rendered, so the bars are in the HTML — the CSS animation only grows
 * them from the baseline, it is not responsible for making them exist.
 */

const W = 720
const H = 260
const PAD_L = 34
const PAD_B = 34
const PAD_T = 16

export function OpeningsChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(...data.map(d => d.openings))
  const peak = Math.max(...data.map(d => d.openings))
  const innerW = W - PAD_L - 12
  const innerH = H - PAD_B - PAD_T
  const slot = innerW / data.length
  const barW = Math.min(38, slot * 0.56)

  // Round the axis up to a clean number so the gridlines read sensibly.
  const axisMax = Math.ceil(max / 25) * 25
  const ticks = [0, axisMax / 2, axisMax]

  return (
    <figure className="chartFigure">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="openingsChart"
        role="img"
        aria-label={`Vacancies opened each month. Peak is ${peak} openings in ${data.find(d => d.openings === peak)?.month}.`}
      >
        {/* gridlines */}
        {ticks.map(t => {
          const y = PAD_T + innerH - (t / axisMax) * innerH
          return (
            <g key={t}>
              <line x1={PAD_L} x2={W - 12} y1={y} y2={y} className="chartGrid" />
              <text x={PAD_L - 8} y={y + 4} className="chartAxisLabel" textAnchor="end">{t}</text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const h = (d.openings / axisMax) * innerH
          const x = PAD_L + i * slot + (slot - barW) / 2
          const y = PAD_T + innerH - h
          const isPeak = d.openings === peak

          return (
            <g key={d.month} className="chartBarGroup">
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={5}
                className={`chartBar${isPeak ? ' chartBarPeak' : ''}`}
                style={{ ['--barH' as any]: `${h}px`, ['--barY' as any]: `${y}px`, animationDelay: `${i * 55}ms` }}
              >
                <title>{`${d.month}: ${d.openings} openings, ${d.applications} applications`}</title>
              </rect>

              {isPeak && (
                <text x={x + barW / 2} y={y - 8} className="chartPeakLabel" textAnchor="middle">
                  {d.openings}
                </text>
              )}

              <text
                x={x + barW / 2}
                y={H - PAD_B + 20}
                className={`chartAxisLabel${isPeak ? ' chartAxisLabelPeak' : ''}`}
                textAnchor="middle"
              >
                {d.month}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="muted">Vacancies opened per month. Hover a bar for that month&rsquo;s application count.</figcaption>
    </figure>
  )
}
