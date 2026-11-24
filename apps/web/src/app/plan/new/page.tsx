'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2, ChevronRight, AlertCircle, Check, Sparkles } from 'lucide-react'
import { ApiLimitError, subjectsApi, plansApi } from '@/lib/api'
import { EmentarioSubjectPicker } from '@/components/EmentarioSubjectPicker'
import { LimitReachedBlock } from '@/components/LimitReachedBlock'
import type { Subject, ParsedSubject, EmentarioEntry, LimitedResponse, NewPlanStep, LearningFormat, StudentProfile } from '@/types'

const extractApiError = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'error' in err) return String((err as { error: string }).error)
  if (err instanceof Error) return err.message
  return fallback
}

const STEPS: { key: NewPlanStep; label: string }[] = [
  { key: 'upload',            label: 'Upload'     },
  { key: 'confirm',           label: 'Confirmar'  },
  { key: 'profile',           label: 'Perfil'     },
  { key: 'configure',         label: 'Configurar' },
  { key: 'generating',        label: 'Gerando'    },
]

const EMENTARIO_STEPS: { key: NewPlanStep; label: string }[] = [
  { key: 'upload',            label: 'Upload'    },
  { key: 'select',            label: 'Selecionar' },
  { key: 'profile',           label: 'Perfil'    },
  { key: 'configure',         label: 'Configurar'},
  { key: 'generating-batch',  label: 'Gerando'   },
]

const KNOWLEDGE_LABELS: Record<number, string> = {
  0: 'Nunca vi esse assunto',
  1: 'Ouvi falar',
  2: 'Vi por alto',
  3: 'Entendo o básico',
  4: 'Sei o essencial',
  5: 'Conheço razoavelmente',
  6: 'Tenho boa base',
  7: 'Domino boa parte',
  8: 'Domino bem',
  9: 'Quase expert',
  10: 'Domino completamente',
}

const FORMAT_OPTIONS: { value: LearningFormat; label: string }[] = [
  { value: 'videos',      label: 'Videos'     },
  { value: 'leitura',     label: 'Leitura'    },
  { value: 'exercicios',  label: 'Exercicios' },
  { value: 'projetos',    label: 'Projetos'   },
  { value: 'flashcards',  label: 'Flashcards' },
  { value: 'podcasts',    label: 'Podcasts'   },
]

const NewPlanPage = () => {
  const router = useRouter()
  const [step, setStep]           = useState<NewPlanStep>('upload')
  const [subject, setSubject]     = useState<Subject | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [scannedHint, setScannedHint] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hoursPerDay, setHoursPerDay] = useState(2)
  const [daysPerWeek, setDaysPerWeek] = useState(5)
  const [examDate, setExamDate]       = useState('')
  const [meta, setMeta] = useState({ course: '', university: '', code: '', credits: '' })

  // Ementário state
  const [ementarioEntries, setEmentarioEntries]     = useState<EmentarioEntry[]>([])
  const [selectionLimit, setSelectionLimit]          = useState(0)
  const [ementarioSubjects, setEmentarioSubjects]   = useState<ParsedSubject[]>([])
  const [limitError, setLimitError]                  = useState<LimitedResponse | null>(null)
  const [selectedIndexes, setSelectedIndexes]        = useState<Set<number>>(new Set())
  const [batchProgress, setBatchProgress]            = useState<{ current: number; total: number; name: string } | null>(null)

  // Student profile state
  const [priorKnowledge, setPriorKnowledge]         = useState(5)
  const [learningFormats, setLearningFormats]        = useState<LearningFormat[]>(['exercicios'])
  const [previousBlocks, setPreviousBlocks]          = useState('')
  const [applicationContext, setApplicationContext]   = useState('')

  const isEmentarioFlow = ementarioEntries.length > 0

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return
    setIsLoading(true); setError(null); setScannedHint(null); setLimitError(null)
    try {
      const res = await subjectsApi.uploadPdf(file)
      if (res.isEmentario) {
        setEmentarioEntries(res.entries)
        setSelectionLimit(res.selection_limit)
        setEmentarioSubjects([])
        setSelectedIndexes(new Set())
        setStep('select')
      } else {
        setSubject(res.subject)
        setMeta({
          course:     res.subject.course     ?? '',
          university: res.subject.university ?? '',
          code:       res.subject.code       ?? '',
          credits:    res.subject.credits    != null ? String(res.subject.credits) : '',
        })
        setStep('confirm')
      }
    } catch (err: unknown) {
      const apiErr = err && typeof err === 'object' ? (err as Record<string, unknown>) : {}
      if (typeof apiErr.code === 'string' && apiErr.code.startsWith('PDF_')) {
        setError(
          (apiErr.message as string | undefined) ??
          'Não foi possível processar este PDF. Tente outro arquivo ou insira o texto manualmente.'
        )
        setScannedHint((apiErr.hint as string | undefined) ?? null)
      } else {
        setError(extractApiError(err, 'Erro ao processar o PDF.'))
        setScannedHint(null)
      }
    } finally { setIsLoading(false) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1, disabled: isLoading,
  })

  const toggleSubjectSelection = (index: number) => {
    // A seleção mudou: o resultado anterior da IA não vale mais.
    setEmentarioSubjects([])
    setSelectedIndexes(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else if (next.size < selectionLimit) next.add(index)
      return next
    })
  }

  const showLimitOrError = (err: unknown, fallback: string) => {
    if (err instanceof ApiLimitError) {
      setLimitError({ limited: true, upgrade_url: err.upgrade_url, usage: err.usage })
      setError(null)
    } else {
      setError(extractApiError(err, fallback))
    }
  }

  const handleConfirmSelection = async () => {
    if (ementarioSubjects.length > 0) { setStep('profile'); return }
    const selectedEntries = ementarioEntries.filter(entry => selectedIndexes.has(entry.index))
    setIsLoading(true); setError(null); setLimitError(null)
    try {
      const { subjects } = await subjectsApi.completeEmentario(selectedEntries)
      setEmentarioSubjects(subjects)
      setStep('profile')
    } catch (err: unknown) {
      showLimitOrError(err, 'Erro ao analisar as disciplinas escolhidas.')
    } finally { setIsLoading(false) }
  }

  const handleGeneratePlan = async () => {
    if (!subject) return
    setStep('generating'); setError(null)
    try {
      const studentProfile: StudentProfile = {
        prior_knowledge_level: priorKnowledge,
        learning_formats: learningFormats,
        previous_blocks: previousBlocks ? previousBlocks.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        application_context: applicationContext,
        weekly_hours_available: hoursPerDay * daysPerWeek,
      }
      const res = await plansApi.generate({
        subject_id: subject.id, hours_per_day: hoursPerDay,
        days_per_week: daysPerWeek, exam_date: examDate || undefined,
        student_profile: studentProfile,
      })
      router.push(`/plan/${res.plan.id}`)
    } catch (err: unknown) {
      setError(extractApiError(err, 'Erro ao gerar o plano.')); setStep('configure')
    }
  }

  const handleGenerateBatch = async () => {
    if (ementarioSubjects.length === 0) return

    setStep('generating-batch'); setError(null); setLimitError(null)
    try {
      const { subjects: savedSubjects } = await subjectsApi.batch(ementarioSubjects)

      const studentProfile: StudentProfile = {
        prior_knowledge_level: priorKnowledge,
        learning_formats: learningFormats,
        previous_blocks: previousBlocks ? previousBlocks.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        application_context: applicationContext,
        weekly_hours_available: hoursPerDay * daysPerWeek,
      }

      for (let idx = 0; idx < savedSubjects.length; idx++) {
        const savedSubject = savedSubjects[idx]
        setBatchProgress({ current: idx + 1, total: savedSubjects.length, name: savedSubject.name })
        await plansApi.generate({
          subject_id: savedSubject.id, hours_per_day: hoursPerDay,
          days_per_week: daysPerWeek, exam_date: examDate || undefined,
          student_profile: studentProfile,
        })
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      showLimitOrError(err, 'Erro ao gerar os planos.'); setStep('configure')
      setBatchProgress(null)
    }
  }

  const activeSteps = isEmentarioFlow ? EMENTARIO_STEPS : STEPS
  const currentIdx  = activeSteps.findIndex(s => s.key === step)

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">

      {/* Page heading */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold leading-tight text-text">Criar novo plano</h1>
        <p className="mt-1 text-sm text-text-muted">Faça upload da ementa e configure sua disponibilidade</p>
      </div>

      {/* Steps */}
      <nav aria-label="Progresso" className="mb-8">
        <ol role="list" className="flex items-center gap-x-2">
          {activeSteps.map((s, i) => {
            const done    = i < currentIdx
            const current = i === currentIdx
            return (
              <li key={s.key} className="flex items-center gap-x-2 flex-1 last:flex-none">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done    ? 'bg-primary text-on-primary' :
                  current ? 'ring-2 ring-primary bg-surface text-primary' :
                            'bg-surface-muted text-text-subtle'
                }`}>
                  {done ? <Check size={12} /> : i + 1}
                </div>
                <span className={`hidden sm:block text-xs font-medium ${current ? 'text-text' : 'text-text-subtle'}`}>
                  {s.label}
                </span>
                {i < activeSteps.length - 1 && (
                  <div className={`flex-1 h-px ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-danger-soft p-4 ring-1 ring-inset ring-danger/20">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-px flex-shrink-0 text-danger" size={15} />
            <p className="text-sm text-on-danger-soft">{error}</p>
          </div>
          {scannedHint && (
            <p className="mt-2.5 border-t border-danger/15 pt-2.5 text-xs text-on-danger-soft/80">
              💡 {scannedHint}
            </p>
          )}
        </div>
      )}

      {limitError && (
        <div className="card mb-6">
          <LimitReachedBlock limitError={limitError} context="inline" />
        </div>
      )}

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
            isDragActive ? 'border-primary/40 bg-primary-soft' : 'border-border-strong bg-surface hover:border-primary/30'
          } ${isLoading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
        >
          <input {...getInputProps()} />

          {isLoading ? (
            <>
              <Loader2 className="animate-spin text-primary mb-3" size={32} />
              <p className="text-sm font-medium text-text">Processando ementa com IA...</p>
              <p className="mt-1 text-xs text-text-subtle">Extraindo tópicos do PDF</p>
            </>
          ) : (
            <>
              <div className={`mb-4 rounded-full p-3 ${isDragActive ? 'bg-primary-soft' : 'bg-surface-muted'}`}>
                <Upload className={isDragActive ? 'text-primary' : 'text-text-subtle'} size={24} />
              </div>
              <p className="text-sm font-semibold text-text">
                {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o PDF da ementa'}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                ou <span className="font-medium text-primary">clique para selecionar</span>
              </p>
              <p className="mt-3 text-xs text-text-subtle">PDF até 10 MB · Ementa única ou Ementário</p>
            </>
          )}
        </div>
      )}

      {/* ── Step: Select (Ementário) ── */}
      {step === 'select' && isEmentarioFlow && (
        <div className="space-y-4">
          <EmentarioSubjectPicker
            entries={ementarioEntries}
            selectedIndexes={selectedIndexes}
            selectionLimit={selectionLimit}
            onToggle={toggleSubjectSelection}
          />

          <div className="flex gap-3">
            <button
              onClick={() => {
                setEmentarioEntries([]); setEmentarioSubjects([]); setSelectedIndexes(new Set())
                setLimitError(null); setError(null); setStep('upload')
              }}
              disabled={isLoading}
              className="btn-secondary flex-1"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={selectedIndexes.size === 0 || isLoading}
              className="btn-primary flex-1"
            >
              {isLoading
                ? <><Loader2 size={15} className="animate-spin" /> Analisando...</>
                : <>Continuar ({selectedIndexes.size}) <ChevronRight size={15} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Confirm ── */}
      {step === 'confirm' && subject && (
        <div className="space-y-4">
          <div className="card divide-y divide-border">

            {/* Subject header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary-soft">
                <FileText className="text-primary" size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{subject.name}</p>
                {subject.workload_hours && (
                  <p className="text-xs text-text-subtle mt-0.5">{subject.workload_hours}h · {subject.topics.length} tópicos</p>
                )}
              </div>
            </div>

            {/* Metadata fields */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle mb-3">
                Complete os dados não encontrados no PDF
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {([
                  { key: 'course',     label: 'Curso'       },
                  { key: 'university', label: 'Instituição' },
                  { key: 'code',       label: 'Código'      },
                  { key: 'credits',    label: 'Créditos'    },
                ] as const).map(({ key, label }) => (
                  <div key={key}>
                    <label htmlFor={`meta-${key}`}>{label}</label>
                    <div className="mt-1.5">
                      <input
                        id={`meta-${key}`}
                        type={key === 'credits' ? 'number' : 'text'}
                        value={meta[key]}
                        onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                        placeholder="Não identificado"
                        className={!meta[key] ? '!ring-2 !ring-warning/40 !bg-warning-soft placeholder:!text-warning/70' : ''}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle mb-3">Tópicos</p>
              <ul role="list" className="space-y-2">
                {subject.topics.slice(0, 5).map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-surface-muted text-[10px] font-bold text-text-subtle">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{t}</span>
                  </li>
                ))}
                {subject.topics.length > 5 && (
                  <li className="text-xs text-text-subtle pl-7">+ {subject.topics.length - 5} tópicos</li>
                )}
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setSubject(null); setStep('upload') }}
              className="btn-secondary flex-1"
            >
              Tentar outro
            </button>
            <button
              onClick={async () => {
                if (!subject) return
                setIsLoading(true)
                try {
                  const patch: Partial<typeof subject> = {}
                  if (meta.course     !== (subject.course     ?? '')) patch.course     = meta.course     || null
                  if (meta.university !== (subject.university ?? '')) patch.university = meta.university || null
                  if (meta.code       !== (subject.code       ?? '')) patch.code       = meta.code       || null
                  const creditsNum = meta.credits ? Number(meta.credits) : null
                  if (creditsNum !== (subject.credits ?? null))       patch.credits    = creditsNum
                  if (Object.keys(patch).length > 0) {
                    const res = await subjectsApi.patch(subject.id, patch)
                    setSubject(res.subject)
                  }
                  setStep('profile')
                } catch { setError('Erro ao salvar metadados.') }
                finally { setIsLoading(false) }
              }}
              disabled={isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <>Confirmar <ChevronRight size={15} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Profile ── */}
      {step === 'profile' && (
        <div>
          {isEmentarioFlow && (
            <div className="mb-4 rounded-md bg-primary-soft p-3 text-xs text-primary">
              Este perfil será aplicado a todas as {selectedIndexes.size} disciplinas selecionadas.
            </div>
          )}
          <div className="card divide-y divide-border">

            {/* Prior knowledge slider */}
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold">Conhecimento prévio no componente</label>
                <span className="badge-primary tabular-nums">{priorKnowledge}/10</span>
              </div>
              <p className="text-xs text-text-subtle mb-3">{KNOWLEDGE_LABELS[priorKnowledge]}</p>
              <input
                type="range" min={0} max={10} step={1} value={priorKnowledge}
                onChange={e => setPriorKnowledge(Number(e.target.value))}
              />
              <div className="mt-2 flex justify-between text-xs text-text-subtle">
                <span>Nunca vi</span><span>Domino</span>
              </div>
            </div>

            {/* Learning formats */}
            <div className="px-5 py-5">
              <label className="font-semibold mb-3 block">Como voce prefere estudar?</label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map(({ value, label }) => {
                  const selected = learningFormats.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLearningFormats(prev =>
                        selected ? prev.filter(f => f !== value) : [...prev, value]
                      )}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-1'
                          : 'bg-surface-muted text-text-muted hover:bg-border'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Application context (Freire) */}
            <div className="px-5 py-5">
              <label htmlFor="app-context" className="font-semibold">
                Por que voce precisa aprender isso?
              </label>
              <p className="text-xs text-text-subtle mt-0.5 mb-2">
                Ex: &quot;Preciso passar na prova de Calculo II&quot; ou &quot;Quero aplicar no meu TCC&quot;
              </p>
              <textarea
                id="app-context"
                rows={2}
                value={applicationContext}
                onChange={e => setApplicationContext(e.target.value)}
                placeholder="Seu objetivo real com esse componente..."
                className="mt-1.5"
              />
            </div>

            {/* Previous blocks */}
            <div className="px-5 py-5">
              <label htmlFor="prev-blocks" className="font-semibold">
                Topicos que te travaram antes <span className="font-normal text-text-subtle">(opcional)</span>
              </label>
              <p className="text-xs text-text-subtle mt-0.5 mb-2">
                Separados por virgula. Ex: &quot;Integrais, Limites&quot;
              </p>
              <input
                id="prev-blocks"
                type="text"
                value={previousBlocks}
                onChange={e => setPreviousBlocks(e.target.value)}
                placeholder="Nenhum"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep(isEmentarioFlow ? 'select' : 'confirm')} className="btn-secondary flex-1">
              Voltar
            </button>
            <button
              onClick={() => setStep('configure')}
              disabled={learningFormats.length === 0}
              className="btn-primary flex-1"
            >
              Continuar <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Configure ── */}
      {step === 'configure' && (
        <div>
          <div className="card divide-y divide-border">

            {/* Hours per day */}
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-3">
                <label className="font-semibold">Horas de estudo por dia</label>
                <span className="badge-primary tabular-nums">{hoursPerDay}h</span>
              </div>
              <input
                type="range" min={0.5} max={8} step={0.5} value={hoursPerDay}
                onChange={e => setHoursPerDay(Number(e.target.value))}
              />
              <div className="mt-2 flex justify-between text-xs text-text-subtle">
                <span>30 min</span><span>8 horas</span>
              </div>
            </div>

            {/* Days per week */}
            <div className="px-3 py-5 sm:px-5">
              <div className="flex items-center justify-between mb-3">
                <label className="font-semibold">Dias por semana</label>
                <span className="badge-primary tabular-nums">{daysPerWeek}×</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((lbl, i) => {
                  const val = i + 1
                  const sel = daysPerWeek === val
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDaysPerWeek(val)}
                      className={`flex flex-col items-center rounded-md py-2.5 text-xs font-bold transition-colors ${
                        sel ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-1'
                            : 'bg-surface-muted text-text-muted hover:bg-border'
                      }`}
                    >
                      <span className="text-sm">{val}</span>
                      <span className={`mt-0.5 text-[9px] font-medium ${sel ? 'text-on-primary/70' : 'text-text-subtle'}`}>{lbl}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Exam date */}
            <div className="px-5 py-5">
              <label htmlFor="exam-date">
                Data da prova <span className="font-normal text-text-subtle">(opcional)</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="exam-date"
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            {isEmentarioFlow ? (
              <button onClick={handleGenerateBatch} className="btn-accent w-full py-2.5">
                <Sparkles size={15} /> Gerar {selectedIndexes.size} plano{selectedIndexes.size !== 1 ? 's' : ''} com IA
              </button>
            ) : (
              <button onClick={handleGeneratePlan} className="btn-primary w-full py-2.5">
                <Sparkles size={15} /> Gerar plano com IA
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step: Generating ── */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="animate-spin text-primary mb-4" size={36} />
          <h2 className="font-display text-xl font-bold text-text">Gerando seu plano...</h2>
          <p className="mt-2 text-sm text-text-muted max-w-xs">
            A IA está criando um cronograma personalizado. Isso leva cerca de 20–30 segundos.
          </p>
        </div>
      )}

      {/* ── Step: Generating Batch ── */}
      {step === 'generating-batch' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="animate-spin text-primary mb-4" size={36} />
          <h2 className="font-display text-xl font-bold text-text">
            {batchProgress
              ? `Gerando plano ${batchProgress.current}/${batchProgress.total}`
              : 'Preparando planos...'}
          </h2>
          {batchProgress && (
            <p className="mt-2 text-sm font-medium text-text-muted">{batchProgress.name}</p>
          )}
          <p className="mt-2 text-sm text-text-subtle max-w-xs">
            Cada plano leva cerca de 20–30 segundos. Não feche esta página.
          </p>
          {batchProgress && (
            <div className="mt-6 w-full max-w-xs">
              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

    </main>
  )
}

export default NewPlanPage
