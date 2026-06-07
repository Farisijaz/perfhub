import './globals.css'

export const metadata = { title: 'PerfHub', description: 'Performance marketing, powered by AI' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
