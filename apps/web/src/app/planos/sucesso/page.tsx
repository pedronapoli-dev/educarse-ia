import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

const CheckoutSuccessPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 mb-4">
      <CheckCircle2 className="text-green-500" size={28} />
    </div>
    <h1 className="text-xl font-bold text-gray-900 mb-2">Assinatura ativada!</h1>
    <p className="text-sm text-gray-500 max-w-sm mb-8">
      Seu plano foi ativado com sucesso. Pode levar alguns segundos para refletir na sua conta.
    </p>
    <Link href="/dashboard" className="btn-primary px-6 py-2.5">
      Ir para o dashboard
    </Link>
  </div>
)

export default CheckoutSuccessPage
