import './globals.css'

export const metadata = {
  title: 'PerfHub — AI Performance OS',
  description: 'AI-powered performance marketing intelligence for agencies'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
