import { describe, it, expect } from 'vitest'
import { getProgressBarColor, formatDateBR } from '../constants'

describe('getProgressBarColor', () => {
  it('retorna verde para progresso >= 75%', () => {
    expect(getProgressBarColor(75)).toBe('bg-green-500')
    expect(getProgressBarColor(100)).toBe('bg-green-500')
  })

  it('retorna indigo para progresso entre 40% e 74%', () => {
    expect(getProgressBarColor(40)).toBe('bg-indigo-600')
    expect(getProgressBarColor(74)).toBe('bg-indigo-600')
  })

  it('retorna âmbar para progresso abaixo de 40%', () => {
    expect(getProgressBarColor(0)).toBe('bg-amber-400')
    expect(getProgressBarColor(39)).toBe('bg-amber-400')
  })
})

describe('formatDateBR', () => {
  it('formata data no padrão dia/mês abreviado em pt-BR', () => {
    const result = formatDateBR('2026-06-15T00:00:00')
    expect(result).toContain('15')
    expect(result.toLowerCase()).toContain('jun')
  })
})
