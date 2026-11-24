// Prepara a imagem de uma página fotografada para o OCR:
// corrige a inclinação e compensa iluminação desigual.

import sharp from 'sharp'

const ANALYSIS_WIDTH = 1000
const MAX_SKEW_DEGREES = 15
const COARSE_STEP_DEGREES = 0.5
const FINE_STEP_DEGREES = 0.1
/** Ignora as bordas, onde costuma aparecer a mesa ou o fundo da foto. */
const ANALYSIS_MARGIN_RATIO = 0.2
/** Só corrige quando o ganho de alinhamento das linhas é claro. */
const MIN_ALIGNMENT_GAIN = 1.1
const MIN_SKEW_TO_CORRECT_DEGREES = 0.2
const DARK_PIXEL_RATIO = 0.6
const CLAHE_TILE_SIZE = 96
const BACKGROUND_BLUR_SIGMA = 35

type DarkPixels = { xs: Int32Array; ys: Int32Array; height: number }

const collectDarkPixels = (pixels: Uint8Array, width: number, height: number): DarkPixels => {
  const startX = Math.floor(width * ANALYSIS_MARGIN_RATIO)
  const endX = width - startX
  const startY = Math.floor(height * ANALYSIS_MARGIN_RATIO)
  const endY = height - startY

  let luminanceSum = 0
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) luminanceSum += pixels[y * width + x]
  }
  const threshold = (luminanceSum / Math.max(1, (endX - startX) * (endY - startY))) * DARK_PIXEL_RATIO

  const xs: number[] = []
  const ys: number[] = []
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (pixels[y * width + x] < threshold) {
        xs.push(x - startX)
        ys.push(y - startY)
      }
    }
  }
  return { xs: Int32Array.from(xs), ys: Int32Array.from(ys), height: endY - startY }
}

/** Linhas de texto alinhadas concentram os pixels escuros em poucas faixas horizontais. */
const scoreAlignment = ({ xs, ys, height }: DarkPixels, degrees: number): number => {
  const slope = Math.tan((degrees * Math.PI) / 180)
  const rowOffset = Math.ceil(Math.abs(slope) * (xs.reduce((max, x) => Math.max(max, x), 0) + 1))
  const rowCounts = new Int32Array(height + rowOffset * 2 + 1)
  for (let pixelIndex = 0; pixelIndex < xs.length; pixelIndex++) {
    rowCounts[Math.round(ys[pixelIndex] + xs[pixelIndex] * slope) + rowOffset]++
  }
  let score = 0
  for (const rowCount of rowCounts) score += rowCount * rowCount
  return score
}

/**
 * Retorna quantos graus girar no sentido horário para alinhar o texto.
 * Retorna 0 quando não há evidência suficiente de inclinação.
 */
export const estimateSkewDegrees = (pixels: Uint8Array, width: number, height: number): number => {
  const darkPixels = collectDarkPixels(pixels, width, height)
  if (darkPixels.xs.length === 0) return 0

  const baselineScore = scoreAlignment(darkPixels, 0)
  let bestDegrees = 0
  let bestScore = baselineScore

  for (let degrees = -MAX_SKEW_DEGREES; degrees <= MAX_SKEW_DEGREES; degrees += COARSE_STEP_DEGREES) {
    const score = scoreAlignment(darkPixels, degrees)
    if (score > bestScore) {
      bestScore = score
      bestDegrees = degrees
    }
  }

  const coarseDegrees = bestDegrees
  for (let offset = -COARSE_STEP_DEGREES; offset <= COARSE_STEP_DEGREES; offset += FINE_STEP_DEGREES) {
    const score = scoreAlignment(darkPixels, coarseDegrees + offset)
    if (score > bestScore) {
      bestScore = score
      bestDegrees = coarseDegrees + offset
    }
  }

  if (bestScore < baselineScore * MIN_ALIGNMENT_GAIN) return 0
  return Math.abs(bestDegrees) < MIN_SKEW_TO_CORRECT_DEGREES ? 0 : Math.round(bestDegrees * 10) / 10
}

export const prepareImageForOcr = async (inputPath: string, outputPath: string): Promise<void> => {
  const { data, info } = await sharp(inputPath)
    .grayscale()
    .resize({ width: ANALYSIS_WIDTH })
    .clahe({ width: CLAHE_TILE_SIZE, height: CLAHE_TILE_SIZE })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const skewDegrees = estimateSkewDegrees(data, info.width, info.height)

  // sharp aplica uma rotação por pipeline: endireita antes de ajustar a iluminação.
  const straightened = skewDegrees === 0
    ? await sharp(inputPath).grayscale().toBuffer()
    : await sharp(inputPath).grayscale().rotate(skewDegrees, { background: '#ffffff' }).toBuffer()

  // Dividir a página pelo próprio fundo desfocado remove sombras e mantém o texto.
  const invertedBackground = await sharp(straightened)
    .blur(BACKGROUND_BLUR_SIGMA)
    .negate({ alpha: false })
    .png()
    .toBuffer()

  const flattened = await sharp(straightened)
    .composite([{ input: invertedBackground, blend: 'colour-dodge' }])
    .png()
    .toBuffer()

  await sharp(flattened).grayscale().normalise().png().toFile(outputPath)
}
