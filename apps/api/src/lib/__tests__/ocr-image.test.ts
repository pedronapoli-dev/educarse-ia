import { describe, it, expect } from 'vitest'
import { estimateSkewDegrees } from '../ocr-image'

const WIDTH = 600
const HEIGHT = 800

/** Página sintética com linhas de texto inclinadas `tiltDegrees` no sentido anti-horário. */
const buildTiltedPage = (tiltDegrees: number): Uint8Array => {
  const pixels = new Uint8Array(WIDTH * HEIGHT).fill(235)
  const slope = Math.tan((tiltDegrees * Math.PI) / 180)
  for (let baseline = -200; baseline < HEIGHT + 200; baseline += 24) {
    for (let x = 0; x < WIDTH; x++) {
      if (x % 14 > 9) continue
      const rowCenter = Math.round(baseline - x * slope)
      for (let y = rowCenter; y < rowCenter + 6; y++) {
        if (y >= 0 && y < HEIGHT) pixels[y * WIDTH + x] = 20
      }
    }
  }
  return pixels
}

describe('estimateSkewDegrees', () => {
  it.each([3, 8, -5])('detecta inclinação de %i graus', tiltDegrees => {
    expect(estimateSkewDegrees(buildTiltedPage(tiltDegrees), WIDTH, HEIGHT)).toBeCloseTo(tiltDegrees, 0)
  })

  it('não gira página já alinhada', () => {
    expect(estimateSkewDegrees(buildTiltedPage(0), WIDTH, HEIGHT)).toBe(0)
  })

  it('não gira página em branco', () => {
    expect(estimateSkewDegrees(new Uint8Array(WIDTH * HEIGHT).fill(255), WIDTH, HEIGHT)).toBe(0)
  })
})
