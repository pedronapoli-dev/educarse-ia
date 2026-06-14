import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { SITE_URL } from '@/lib/constants'

// Inter — corpo e UI: excelente para leitura densa, reconhecível em contexto acadêmico
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Fraunces — display/títulos: serifada orgânica com personalidade óptica variável.
// Resolve a tensão "rigor × calor": serifa intelectual mas com traço caligráfico quente.
// Bringhurst: "a typeface must serve the text" — aqui serve a hierarquia de cabeçalhos.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  style: ['normal', 'italic'],
  weight: ['300', '400', '600', '700'],
  display: 'swap',
})

const title = 'educar-se-ia — Planos de estudo com IA'
const description = 'Transforme sua ementa em um plano de estudos personalizado em menos de 60 segundos.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'educar-se-ia',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      {/* Variables de fonte injetadas pelo next/font; bg/text vêm dos tokens em globals.css */}
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
        <Navbar />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
