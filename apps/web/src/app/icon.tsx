import { ImageResponse } from 'next/og'

import { BRAND_SYMBOL_DOT, BRAND_SYMBOL_PATH } from '@/lib/brand-symbol'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon — espiral de aprendizagem (variante principal), ver BrandMark.tsx.
// ImageResponse/satori não processa Tailwind: cores em hex (teal-800,
// creme-50, terra-500).
const Icon = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32">
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
      </div>
    ),
    { ...size },
  )

export default Icon
