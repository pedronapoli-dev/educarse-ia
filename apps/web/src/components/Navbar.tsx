'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Plus, LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/BrandMark'

export const Navbar = () => {
  const pathname = usePathname()
  const router   = useRouter()

  if (pathname === '/login' || pathname === '/') return null

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinkClass = (href: string) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-standard',
      pathname === href
        ? 'bg-surface-muted text-text'
        : 'text-text-muted hover:bg-surface-muted hover:text-text',
    )

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border">
      <nav className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8" aria-label="Global">
        <div className="flex h-14 items-center justify-between">

          {/* Logo / wordmark */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight text-text group-hover:text-primary transition-colors duration-fast ease-standard">
              educar-se-ia
            </span>
          </Link>

          {/* Navegação direita */}
          <div className="flex items-center gap-x-1">
            <Link href="/dashboard" className={navLinkClass('/dashboard')}>
              Planos
            </Link>

            <Link href="/plan/new" className="btn-primary ml-2 py-1.5">
              <Plus size={14} aria-hidden="true" /> Novo plano
            </Link>

            <Link
              href="/conta"
              title="Minha conta"
              className={cn(navLinkClass('/conta'), 'ml-1 p-2')}
            >
              <Settings size={15} aria-hidden="true" />
            </Link>

            <button
              onClick={handleLogout}
              title="Sair"
              className="btn-ghost ml-1 p-2"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>

        </div>
      </nav>
    </header>
  )
}
