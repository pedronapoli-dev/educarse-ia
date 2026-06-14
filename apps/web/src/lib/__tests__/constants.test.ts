import { describe, it, expect } from 'vitest'
import { getProgressBarColor, formatDateBR } from '../constants'

describe('getProgressBarColor', () => {
  it('retorna success para progresso >= 75%', () => {
    expect(getProgressBarColor(75)).toBe('bg-success')
    expect(getProgressBarColor(100)).toBe('bg-success')
  })

  it('retorna primary para progresso entre 40% e 74%', () => {
    expect(getProgressBarColor(40)).toBe('bg-primary')
    expect(getProgressBarColor(74)).toBe('bg-primary')
  })

  it('retorna warning para progresso abaixo de 40%', () => {
    expect(getProgressBarColor(0)).toBe('bg-warning')
    expect(getProgressBarColor(39)).toBe('bg-warning')
  })
})

describe('formatDateBR', () => {
  it('formata data no padrão dia/mês abreviado em pt-BR', () => {
    const result = formatDateBR('2026-06-15T00:00:00')
    expect(result).toContain('15')
    expect(result.toLowerCase()).toContain('jun')
  })
})
