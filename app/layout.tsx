import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/Nav'

// Two roles, deliberately different in character: Space Grotesk carries the
// headlines (confident, geometric, a little technical — reads as "matching
// engine"), Inter carries body copy and dense form UI where plain legibility
// matters most for a broad, low-bandwidth audience.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' })
const display = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-display' })

export const metadata: Metadata = {
  title: 'अवसर · Awasar',
  description: 'Local job search and AI-powered compatibility matching for Jhapa, Nepal.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        <Nav />
        <main className="pageFade">{children}</main>
        <footer><b>अवसर · Awasar</b> — सही काम, सही अवसर. AI assists matching; employers make the final hiring decision.</footer>
      </body>
    </html>
  )
}
