import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'

export const Footer = () => {
  return (
    <footer className="bg-primary">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <BrandMark inverted className="h-6 w-6 text-sm" />
          <span className="text-xs font-semibold text-on-primary">educar-se-ia</span>
        </div>

        <nav className="flex items-center gap-4 text-xs text-on-primary/70">
          <Link href="/termos" className="hover:text-on-primary transition-colors duration-fast ease-standard">Termos de Uso</Link>
          <Link href="/privacidade" className="hover:text-on-primary transition-colors duration-fast ease-standard">Política de Privacidade</Link>
          <a href="mailto:contato@educarse-ia.com.br" className="hover:text-on-primary transition-colors duration-fast ease-standard">Contato</a>
        </nav>

        <p className="text-xs text-on-primary/70">
          &copy; {new Date().getFullYear()} educar-se-ia. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
