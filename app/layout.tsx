import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Damak Job Hunter',
  description: 'AI-powered local job matching for Damak, Jhapa, Nepal.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer>Built for local job matching in Damak, Jhapa · AI assists decisions; employers make final hiring choices.</footer>
      </body>
    </html>
  )
}
