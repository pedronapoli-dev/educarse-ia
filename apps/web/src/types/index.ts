/**
 * Re-exporta @educarseia/types.
 * No frontend, importe SEMPRE de '@/types', nunca direto de '@educarseia/types'.
 *
 * Tipos exclusivos de UI (sem equivalente no backend) ficam abaixo.
 */
export * from '@educarseia/types'

export type LoadingState  = 'idle' | 'loading' | 'success' | 'error'
export type NewPlanStep   = 'upload' | 'confirm' | 'profile' | 'configure' | 'generating'
