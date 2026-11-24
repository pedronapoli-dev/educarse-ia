import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockEq, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const queryChain: Record<string, unknown> = { maybeSingle: mockMaybeSingle }
  const mockEq = vi.fn(() => queryChain)
  queryChain.eq = mockEq
  queryChain.select = vi.fn(() => queryChain)
  return { mockFrom: vi.fn(() => queryChain), mockEq, mockMaybeSingle }
})

vi.mock('../supabase', () => ({ supabase: { from: mockFrom } }))

import { isPlanOwnedByUser } from '../plan-ownership'

beforeEach(() => { vi.clearAllMocks() })

describe('isPlanOwnedByUser', () => {
  it('filtra por plano e usuário e retorna true quando o plano existe', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'plan-1' }, error: null })

    await expect(isPlanOwnedByUser('user-1', 'plan-1')).resolves.toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('plans')
    expect(mockEq).toHaveBeenCalledWith('id', 'plan-1')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('retorna false quando o plano não pertence ao usuário', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await expect(isPlanOwnedByUser('user-1', 'plan-2')).resolves.toBe(false)
  })

  it('propaga erros do banco', async () => {
    const databaseError = new Error('db indisponível')
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: databaseError })

    await expect(isPlanOwnedByUser('user-1', 'plan-1')).rejects.toThrow('db indisponível')
  })
})
