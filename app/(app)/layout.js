import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <div className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">PerfHub</span>
        </div>
        <nav className="flex-1 p-2">
          <a href="/clients" className="nav-item mb-0.5 block">Clients</a>
          <a href="/audit" className="nav-item mb-0.5 block">Account audit</a>
          <a href="/competitors" className="nav-item mb-0.5 block">Competitor intel</a>
          <a href="/strategy" className="nav-item mb-0.5 block">Strategy</a>
          <a href="/creative" className="nav-item mb-0.5 block">Ad creative</a>
          <a href="/reports" className="nav-item mb-0.5 block">Reports</a>
        </nav>
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}