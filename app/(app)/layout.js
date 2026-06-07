import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
        <nav className="flex-1 p-2 space-y-0.5">
          <Link href="/clients" className="block px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900">Clients</Link>
          <Link href="/audit" className="block px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900">Account audit</Link>
          <Link href="/competitors" className="block px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900">Competitor intel</Link>
          <Link href="/strategy" className="block px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900">Strategy</Link>
          <Link href="/creative" className="block px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900">Ad creative</Link>
          <Link href="/reports" className="block px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900">Reports</Link>
        </nav>
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
