import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAsyncAction } from '../useAsyncAction'
import { ApiLimitError, ApiCooldownError } from '@/lib/api'
import type { LimitedResponse, CooldownResponse } from '@/types'

describe('useAsyncAction', () => {
  it('define result em caso de sucesso, sem popular nenhum estado de erro', async () => {
    const { result } = renderHook(() => useAsyncAction<string>())

    await act(async () => {
      await result.current.execute(async () => 'ok')
    })

    expect(result.current.result).toBe('ok')
    expect(result.current.error).toBeNull()
    expect(result.current.limitError).toBeNull()
    expect(result.current.cooldownError).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('popula limitError quando ApiLimitError é lançado', async () => {
    const { result } = renderHook(() => useAsyncAction<string>())
    const limitData: LimitedResponse = {
      limited: true,
      upgrade_url: '/planos',
      usage: { used: 10, max: 10, percent: 100 },
    }

    await act(async () => {
      await result.current.execute(async () => { throw new ApiLimitError(limitData) })
    })

    expect(result.current.limitError).toEqual(limitData)
    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
  })

  it('popula cooldownError quando ApiCooldownError é lançado', async () => {
    const { result } = renderHook(() => useAsyncAction<string>())
    const cooldownData: CooldownResponse = {
      cooldown: true,
      retry_at: '2026-06-12T00:00:00Z',
      message: 'Aguarde antes de tentar novamente.',
    }

    await act(async () => {
      await result.current.execute(async () => { throw new ApiCooldownError(cooldownData) })
    })

    expect(result.current.cooldownError).toEqual(cooldownData)
    expect(result.current.error).toBeNull()
  })

  it('define error com a mensagem para erros genéricos', async () => {
    const { result } = renderHook(() => useAsyncAction<string>())

    await act(async () => {
      await result.current.execute(async () => { throw new Error('Falhou') })
    })

    expect(result.current.error).toBe('Falhou')
    expect(result.current.limitError).toBeNull()
    expect(result.current.cooldownError).toBeNull()
  })

  it('reset limpa result e todos os estados de erro', async () => {
    const { result } = renderHook(() => useAsyncAction<string>())

    await act(async () => {
      await result.current.execute(async () => { throw new Error('Falhou') })
    })
    act(() => result.current.reset())

    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.limitError).toBeNull()
    expect(result.current.cooldownError).toBeNull()
  })
})
