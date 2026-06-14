'use client'

import './globals.css'

const GlobalError = ({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-bg font-sans text-text antialiased">
        <main className="max-w-md px-4 text-center">
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="mt-2 text-sm text-text-muted">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button onClick={reset} className="btn-primary mt-6">
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  )
}

export default GlobalError
