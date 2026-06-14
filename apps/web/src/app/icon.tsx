import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Marca tipográfica mínima: "e" em teal-petróleo sobre creme.
// Sem GraduationCap (genérico de edtech); sem indigo (padrão Tailwind).
// Raio 7 ≈ radius-md proporcional ao tamanho de 32px.
const Icon = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          backgroundColor: '#1A4E5C',
          color: '#FFFDF9',
          fontFamily: 'Georgia, serif',
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          paddingBottom: 1,
        }}
      >
        e
      </div>
    ),
    { ...size },
  )

export default Icon
