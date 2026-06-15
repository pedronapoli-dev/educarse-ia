'use client'

import { useEffect } from 'react'

const ErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h2 className="font-display text-lg font-semibold text-text">Algo deu errado</h2>
      <p className="mt-2 text-sm text-text-muted">
        Ocorreu um erro inesperado. Tente novamente ou volte para o início.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary">
          Tentar novamente
        </button>
        <a href="/dashboard" className="btn-secondary">
          Voltar ao início
        </a>
      </div>
    </main>
  )
}

export default ErrorPage
