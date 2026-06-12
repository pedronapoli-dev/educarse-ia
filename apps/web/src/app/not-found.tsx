import Link from 'next/link'
import { SearchX } from 'lucide-react'

const NotFoundPage = () => (
  <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
      <SearchX className="text-indigo-600" size={22} />
    </div>
    <h2 className="text-lg font-semibold text-gray-900">Página não encontrada</h2>
    <p className="mt-2 text-sm text-gray-500">
      A página que você procura não existe ou foi movida.
    </p>
    <div className="mt-6">
      <Link href="/" className="btn-primary">
        Voltar para o início
      </Link>
    </div>
  </main>
)

export default NotFoundPage
