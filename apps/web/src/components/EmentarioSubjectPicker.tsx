'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmentarioEntry } from '@/types'

interface Props {
  entries: EmentarioEntry[]
  selectedIndexes: Set<number>
  selectionLimit: number
  onToggle: (index: number) => void
}

const toSearchable = (value: string): string =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const EmentarioSubjectPicker = ({ entries, selectedIndexes, selectionLimit, onToggle }: Props) => {
  const [searchTerm, setSearchTerm] = useState('')

  const visibleEntries = useMemo(() => {
    const normalizedTerm = toSearchable(searchTerm.trim())
    if (!normalizedTerm) return entries
    return entries.filter(entry => toSearchable(`${entry.name} ${entry.code ?? ''}`).includes(normalizedTerm))
  }, [entries, searchTerm])

  const selectedEntries = entries.filter(entry => selectedIndexes.has(entry.index))
  const isLimitReached = selectedIndexes.size >= selectionLimit

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-accent-soft">
          <BookOpen className="text-accent" size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Ementário com {entries.length} disciplinas</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {selectionLimit > 0
              ? `Quais são essenciais para o seu plano agora? Escolha até ${selectionLimit}.`
              : 'Seu plano atual não tem saldo para criar novos planos de estudo.'}
          </p>
        </div>
      </div>

      {selectionLimit === 0 ? (
        <Link href="/planos" className="btn-primary w-full">Ver planos</Link>
      ) : (
        <>
          <label htmlFor="ementario-search">Buscar disciplina</label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" size={15} />
            <input
              id="ementario-search"
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Nome ou código. Ex.: Cálculo, MAT-103"
              className="!pl-9"
            />
          </div>

          {selectedEntries.length > 0 && (
            <ul aria-label="Disciplinas escolhidas" className="mt-3 flex flex-wrap gap-2">
              {selectedEntries.map(entry => (
                <li key={entry.index}>
                  <button
                    type="button"
                    onClick={() => onToggle(entry.index)}
                    aria-label={`Remover ${entry.name}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    <span className="truncate">{entry.name}</span>
                    <X size={12} className="flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto">
            {visibleEntries.map(entry => {
              const isSelected = selectedIndexes.has(entry.index)
              const isDisabled = !isSelected && isLimitReached
              const details = [entry.code, entry.workload_hours ? `${entry.workload_hours}h` : null].filter(Boolean).join(' · ')
              return (
                <li key={entry.index}>
                  <button
                    type="button"
                    onClick={() => onToggle(entry.index)}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-sm px-1 py-3 text-left transition-colors',
                      isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-subtle',
                    )}
                  >
                    <div className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
                      isSelected ? 'border-primary bg-primary' : 'border-border-strong bg-surface',
                    )}>
                      {isSelected && <Check size={11} className="text-on-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{entry.name}</p>
                      {details && <p className="mt-0.5 text-xs text-text-subtle">{details}</p>}
                    </div>
                  </button>
                </li>
              )
            })}
            {visibleEntries.length === 0 && (
              <li className="py-6 text-center text-sm text-text-muted">Nenhuma disciplina encontrada.</li>
            )}
          </ul>

          <p aria-live="polite" className="mt-3 text-xs text-text-subtle">
            {selectedIndexes.size} de {selectionLimit} escolhidas
          </p>
        </>
      )}
    </div>
  )
}
