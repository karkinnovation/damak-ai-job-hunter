import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'

export const metadata: Metadata = {
  title: 'अवसर · Awasar',
  description: 'Local job search and AI-powered compatibility matching for Jhapa, Nepal.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer><b>अवसर · Awasar</b> — सही काम, सही अवसर. AI assists matching; employers make the final hiring decision.</footer>
      </body>
    </html>
  )
}
