import { ImageResponse } from 'next/og'

import { BRAND_SYMBOL_DOT, BRAND_SYMBOL_PATH } from '@/lib/brand-symbol'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// OG 1200×630 — identidade Teal-Petróleo × Terracota × Creme.
// Layout: fundo escuro (teal-950) + bloco de texto à esquerda + elemento de acento.
// Mayer (princípio de sinalização): hierarquia visual clara — marca → tagline → detalhe.
// Cores: teal-950 (#081C22) bg, creme-50 (#FFFDF9) texto, terra-700 (#A8452A) acento.
const OpengraphImage = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#081C22',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Elemento decorativo: círculo de acento terracota (canto direito) */}
        <div
          style={{
            position: 'absolute',
            right: -160,
            top: -160,
            width: 560,
            height: 560,
            borderRadius: '50%',
            backgroundColor: '#A8452A',
            opacity: 0.15,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 80,
            bottom: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            backgroundColor: '#226070',
            opacity: 0.2,
          }}
        />

        {/* Conteúdo principal */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '80px 100px',
            gap: 0,
            flex: 1,
          }}
        >
          {/* Marca */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <svg width="44" height="44" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="7" fill="#1A4E5C" />
              <path
                d={BRAND_SYMBOL_PATH}
                fill="none"
                stroke="#FFFDF9"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              <circle cx={BRAND_SYMBOL_DOT.cx} cy={BRAND_SYMBOL_DOT.cy} r={BRAND_SYMBOL_DOT.r} fill="#DC805A" />
            </svg>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: '#A8452A',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'Georgia, serif',
              }}
            >
              educar-se-ia
            </div>
          </div>

          {/* Título principal */}
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: '#FFFDF9',
              letterSpacing: '-2px',
              lineHeight: 1.05,
              fontFamily: 'Georgia, serif',
              maxWidth: 820,
            }}
          >
            Seu plano de estudos, feito pela ciência.
          </div>

          {/* Subtítulo */}
          <div
            style={{
              marginTop: 32,
              fontSize: 28,
              color: '#B8DDE6',
              lineHeight: 1.4,
              fontFamily: 'sans-serif',
              fontWeight: 400,
              maxWidth: 680,
            }}
          >
            Transforme sua ementa em um cronograma personalizado — baseado em Bloom, Vygotsky e Ebbinghaus.
          </div>
        </div>
      </div>
    ),
    { ...size },
  )

export default OpengraphImage
