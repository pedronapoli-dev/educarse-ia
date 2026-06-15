import Link from 'next/link'
import {
  Upload, UserCog, Sparkles, TrendingUp,
  Brain, Layers, Target, BookOpen, BarChart3, RefreshCw, Zap,
  ArrowRight, CheckCircle2,
} from 'lucide-react'
import { Footer } from '@/components/Footer'
import { BrandMark } from '@/components/BrandMark'
import { cn } from '@/lib/utils'

// ── Static data ──────────────────────────────────────────────

const STEPS = [
  {
    icon: Upload,
    title: 'Envie sua ementa',
    description: 'Upload do PDF ou cole o texto. A IA extrai tópicos, pré-requisitos e bibliografia.',
  },
  {
    icon: UserCog,
    title: 'Configure seu perfil',
    description: 'Nível de conhecimento, formatos preferidos e por que precisa aprender.',
  },
  {
    icon: Sparkles,
    title: 'Receba seu plano',
    description: 'Cronograma semanal personalizado com teoria, prática e revisão espaçada.',
  },
  {
    icon: TrendingUp,
    title: 'Estude com acompanhamento',
    description: 'Exercícios, check-ins semanais e recalibração quando você travar.',
  },
] as const

const FEATURES = [
  { icon: Brain,      title: 'Taxonomia de Bloom',     description: 'Cada sessão tem nível cognitivo definido — de recordar a criar.' },
  { icon: Layers,     title: 'Scaffolding progressivo', description: 'Suporte alto no início, autonomia total no final.' },
  { icon: Target,     title: 'Critérios de maestria',   description: 'Saiba exatamente o que precisa dominar antes de avançar.' },
  { icon: RefreshCw,  title: 'Revisão espaçada (SM-2)', description: 'Algoritmo científico define quando revisar cada tópico.' },
  { icon: BarChart3,  title: 'Check-in semanal',        description: 'Avaliação quantitativa e qualitativa com ações concretas.' },
  { icon: Zap,        title: 'Recalibração inteligente', description: 'Travou? A IA diagnostica o bloqueio e ajusta o plano.' },
] as const

const FRAMEWORKS = [
  'Freire (autonomia)',
  'Vygotsky (zona de desenvolvimento proximal)',
  'Bloom (taxonomia cognitiva)',
  'Piaget (construtivismo)',
  'Sweller (carga cognitiva)',
  'Ebbinghaus (repetição espaçada)',
  'Darcy Ribeiro (educação integral)',
] as const

// ── Mock data for the demo ───────────────────────────────────

const MOCK_EMENTA = `Cálculo Diferencial e Integral II
MAT0122 — Engenharia Civil — 4 créditos

Ementa: Integrais definidas e indefinidas.
Técnicas de integração. Integrais impróprias.
Sequências e séries numéricas. Séries de
potências. Séries de Taylor. Aplicações...`

const MOCK_PLAN_WEEKS = [
  {
    week: 1,
    focus: 'Fundamentos de integração',
    days: [
      { topic: 'Integral indefinida e antiderivadas',     type: 'teoria',    bloom: 'Compreender', done: true },
      { topic: 'Regras básicas de integração',             type: 'exercicio', bloom: 'Aplicar',     done: true },
      { topic: 'Integral definida e Teorema Fundamental', type: 'teoria',    bloom: 'Compreender', done: false },
      { topic: 'Revisão: antiderivadas + TFC',            type: 'revisao',   bloom: 'Recordar',    done: false },
    ],
  },
  {
    week: 2,
    focus: 'Técnicas de integração',
    days: [
      { topic: 'Integração por substituição',    type: 'teoria',    bloom: 'Aplicar',  done: false },
      { topic: 'Integração por partes',           type: 'teoria',    bloom: 'Aplicar',  done: false },
      { topic: 'Prática: substituição + partes',  type: 'exercicio', bloom: 'Analisar', done: false },
    ],
  },
]

// Tipo de sessão → variante semântica de badge do sistema.
// teoria = conteúdo conceitual (marca/teal) · exercício = esforço ativo (acento/terracota)
// · revisão = atenção/Ebbinghaus (âmbar) — mesmo mapeamento de DayItem.
const TYPE_BADGE: Record<string, string> = {
  teoria:    'badge-primary',
  exercicio: 'badge-accent',
  revisao:   'badge-amber',
}

const TYPE_LABELS: Record<string, string> = {
  teoria: 'Teoria', exercicio: 'Prática', revisao: 'Revisão',
}

// ── Page ──────────────────────────────────────────────────────

const LandingPage = () => {
  return (
    <div className="bg-bg">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-sm border-b border-border">
        <nav className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandMark />
              <span className="text-sm font-semibold tracking-tight text-text group-hover:text-primary transition-colors duration-fast ease-standard">
                educar-se-ia
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/planos" className="hidden sm:inline-block text-sm font-medium text-text-muted hover:text-text transition-colors duration-fast ease-standard">
                Planos
              </Link>
              <Link href="/login" className="text-sm font-medium text-text-muted hover:text-text transition-colors duration-fast ease-standard">
                Entrar
              </Link>
              <Link href="/login" className="btn-accent py-1.5 text-sm">
                Começar grátis
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 pt-18 pb-22 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
              Estudo inteligente com IA
            </p>
            <h1 className="font-display font-bold tracking-tight text-text text-3xl sm:text-4xl lg:text-5xl leading-[1.15]">
              Sua ementa vira um plano de estudos{' '}
              <span className="text-accent">em 60 segundos</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
              Envie o PDF da sua disciplina e receba um cronograma semanal personalizado
              com teoria, prática, revisão espaçada e exercícios adaptativos.
              Fundamentado em 7 teorias pedagógicas, não em achismo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-accent px-5 py-2.5 text-base">
                Criar meu plano grátis <ArrowRight size={16} />
              </Link>
              <a href="#como-funciona" className="btn-secondary px-5 py-2.5 text-base">
                Como funciona
              </a>
            </div>
            <p className="mt-4 text-xs text-text-subtle">
              Gratuito — até 2 planos, sem cartão de crédito.
            </p>
          </div>
        </div>
        {/* Acentos decorativos: mesmo par teal/terracota da opengraph-image —
            rima visual entre os pontos de contato (Müller-Brockmann: consistência sistêmica). */}
        <div className="absolute -top-20 -right-20 h-[250px] w-[250px] sm:-top-40 sm:-right-40 sm:h-[500px] sm:w-[500px] rounded-full bg-teal-100 blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute top-12 -right-8 h-[140px] w-[140px] sm:top-24 sm:-right-16 sm:h-[280px] sm:w-[280px] rounded-full bg-terra-100 blur-3xl opacity-50 pointer-events-none" />
      </section>

      {/* ── Demo: Ementa → Plano ───────────────────────────── */}
      <section className="bg-surface-muted py-18 sm:py-22">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-display font-bold text-text text-xl sm:text-2xl">De ementa confusa a plano claro</h2>
            <p className="mt-2 text-sm text-text-muted">Veja a transformação que a IA faz com o conteúdo da sua disciplina.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 items-start">

            {/* Before: raw ementa */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-text-subtle" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">Ementa original</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted font-mono bg-bg rounded-lg p-4 ring-1 ring-border">
                {MOCK_EMENTA}
              </pre>
            </div>

            {/* After: generated plan */}
            <div className="card border-primary/30 shadow-md p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Plano gerado</span>
              </div>

              <div className="space-y-4">
                {MOCK_PLAN_WEEKS.map(week => (
                  <div key={week.week}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-on-primary">
                        {week.week}
                      </span>
                      <span className="text-xs font-semibold text-text">{week.focus}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {week.days.map((day, i) => (
                        <li
                          key={i}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ring-1 ring-border',
                            day.done ? 'bg-surface-muted opacity-60' : 'bg-surface',
                          )}
                        >
                          <CheckCircle2
                            size={14}
                            className={day.done ? 'text-success flex-shrink-0' : 'text-border-strong flex-shrink-0'}
                          />
                          <span className={cn('flex-1 truncate', day.done ? 'line-through text-text-subtle' : 'text-text')}>
                            {day.topic}
                          </span>
                          <span className={cn(TYPE_BADGE[day.type], 'rounded-full px-1.5 py-0.5 text-[10px]')}>
                            {TYPE_LABELS[day.type]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────── */}
      <section id="como-funciona" className="py-18 sm:py-22">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-text text-xl sm:text-2xl">Como funciona</h2>
            <p className="mt-2 text-sm text-text-muted">4 passos entre receber a ementa e começar a estudar.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary mb-4">
                    <Icon size={22} />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Passo {i + 1}</div>
                  <h3 className="text-sm font-semibold text-text mb-1.5">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-text-muted">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section className="bg-surface-muted py-18 sm:py-22">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-text text-xl sm:text-2xl">Não é só um cronograma</h2>
            <p className="mt-2 text-sm text-text-muted">Cada plano aplica princípios pedagógicos reais.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon
              return (
                <div key={i} className="card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary flex-shrink-0">
                      <Icon size={16} />
                    </div>
                    <h3 className="text-sm font-semibold text-text">{feat.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-text-muted">{feat.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Fundamento pedagógico ──────────────────────────── */}
      <section className="py-18 sm:py-22">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display font-bold text-text text-xl sm:text-2xl mb-3">Fundamentado em ciência</h2>
          <p className="text-sm leading-relaxed text-text-muted mb-8">
            Cada decisão do plano — a ordem dos tópicos, o nível dos exercícios, quando revisar, quando
            aumentar a dificuldade — vem de pesquisa pedagógica real, não de palpite.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {FRAMEWORKS.map(f => (
              <span
                key={f}
                className="inline-flex items-center rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-inset ring-teal-200"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="bg-primary py-18 sm:py-22">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display font-bold text-on-primary text-xl sm:text-2xl">Pronto para estudar melhor?</h2>
          <p className="mt-3 text-sm text-on-primary/70">
            Crie seu primeiro plano em menos de 60 segundos. Grátis, sem cartão.
          </p>
          <Link href="/login" className="btn-accent mt-6 px-6 py-2.5 text-sm">
            Criar meu plano <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default LandingPage
