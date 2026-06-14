'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Loader2, AlertTriangle, AlertCircle } from 'lucide-react'
import { accountApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'

interface Props {
  onClose: () => void
}

const CONFIRM_WORD = 'EXCLUIR'

export const DeleteAccountModal = ({ onClose }: Props) => {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      await accountApi.delete()
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Conta excluída com sucesso.')
      router.push('/')
      router.refresh()
    } catch {
      setError('Não foi possível excluir sua conta. Tente novamente ou contate o suporte.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-text/50" onClick={onClose} />

      <div className="relative flex w-full max-h-[90vh] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:my-8 sm:max-w-md sm:max-h-[80vh] sm:rounded-lg">

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger" />
            <h2 className="font-semibold text-text">Excluir conta</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-text-subtle hover:bg-surface-muted hover:text-text-muted" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            Esta ação é <span className="font-semibold text-text">permanente</span>. Todos os seus
            planos, disciplinas, exercícios e sessões de estudo serão excluídos. Se você tiver uma
            assinatura ativa, ela será cancelada.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 rounded-md bg-danger-soft p-3.5 ring-1 ring-inset ring-danger/20">
              <AlertCircle className="mt-px flex-shrink-0 text-danger" size={15} />
              <p className="text-sm text-on-danger-soft">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="confirm-delete">
              Digite <span className="font-semibold text-text">{CONFIRM_WORD}</span> para confirmar
            </label>
            <div className="mt-1.5">
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
              />
            </div>
          </div>

          <button
            onClick={handleDelete}
            disabled={confirmText !== CONFIRM_WORD || loading}
            className="btn w-full bg-danger text-text-on-dark hover:bg-danger/90"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Excluir minha conta permanentemente
          </button>
        </div>
      </div>
    </div>
  )
}
