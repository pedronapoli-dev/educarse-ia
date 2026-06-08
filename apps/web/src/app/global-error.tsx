'use client'

const GlobalError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900 antialiased">
        <main className="max-w-md px-4 text-center">
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="mt-2 text-sm text-gray-500">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  )
}

export default GlobalError
