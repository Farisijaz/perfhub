import './globals.css'

export const metadata = {
  title: 'PerfHub — Performance Marketing Platform',
  description: 'AI-powered performance marketing for your agency',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
