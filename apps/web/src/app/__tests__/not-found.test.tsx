import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFoundPage from '../not-found'

describe('NotFoundPage', () => {
  it('renderiza heading, descrição e link de volta para o início', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('A página que você procura não existe ou foi movida.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/')
  })
})
