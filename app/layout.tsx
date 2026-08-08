import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/Nav'

// next/font self-hosts Inter at build time (no external request at runtime,
// no layout shift) so the real brand font loads instantly and matches the
// `font-family: Inter` already declared in globals.css.
const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'अवसर · Awasar',
  description: 'Local job search and AI-powered compatibility matching for Jhapa, Nepal.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        <main className="pageFade">{children}</main>
        <footer><b>अवसर · Awasar</b> — सही काम, सही अवसर. AI assists matching; employers make the final hiring decision.</footer>
      </body>
    </html>
  )
}
