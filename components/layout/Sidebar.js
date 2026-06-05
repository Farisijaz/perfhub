'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { useState } from 'react'
import { TrendingUp, Building2, BarChart3, Eye, Map, Wand2, LayoutDashboard, Settings, LogOut, ChevronDown } from 'lucide-react'

const agents = [
  { label: 'Account audit',    icon: BarChart3,       href: '/audit',       badge: '1' },
  { label: 'Competitor intel', icon: Eye,             href: '/competitors', badge: '2' },
  { label: 'Strategy',         icon: Map,             href: '/strategy',    badge: '3' },
  { label: 'Ad creative',      icon: Wand2,           href: '/creative',    badge: '4' },
  { label: 'Reports',          icon: LayoutDashboard, href: '/reports',     badge: '5' },
]

export default function Sidebar({ user }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function signOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-dark flex items-center justify-center">
            <TrendingUp size={14} className="text-brand-gold" />
          </div>
          <span className="text-sm font-semibold text-gray-900">PerfHub</span>
        </div>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        <Link href="/clients" className={`nav-item mb-0.5 ${pathname === '/clients' ? 'active' : ''}`}>
          <Building2 size={15} /> Clients
        </Link>

        <p className="text-[10px] font-medium text-gray-400 px-3 pt-4 pb-1 uppercase tracking-widest">Agents</p>

        {agents.map(({ label, icon: Icon, href, badge }) => (
          <Link key={href} href={href} className={`nav-item mb-0.5 ${pathname.startsWith(href) ? 'active' : ''}`}>
            <Icon size={15} />
            <span className="flex-1">{label}</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 font-medium">{badge}</span>
          </Link>
        ))}

        <p className="text-[10px] font-medium text-gray-400 px-3 pt-4 pb-1 uppercase tracking-widest">Settings</p>
        <button className="nav-item mb-0.5"><Settings size={15} /> Settings</button>
      </nav>

      <div className="p-2 border-t border-gray-100 relative">
        <button className="nav-item" onClick={() => setMenuOpen(!menuOpen)}>
          <div className="w-6 h-6 rounded-full bg-brand-dark text-brand-gold text-[10px] font-medium flex items-center justify-center shrink-0">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="flex-1 text-left truncate text-xs">{user?.email?.split('@')[0]}</span>
          <ChevronDown size={13} />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-50">
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={signOut}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
