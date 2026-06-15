#!/usr/bin/env node
// Exporta o símbolo de marca (espiral de aprendizagem, DESIGN_SYSTEM.md §5)
// para uso fora do app — Discord, redes sociais, etc.
// Fonte única: apps/web/src/lib/brand-symbol.ts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'apps/web/src/lib/brand-symbol.ts'), 'utf-8')

const pathMatch = source.match(/BRAND_SYMBOL_PATH =\s*\n?\s*'([^']+)'/)
const dotMatch = source.match(/BRAND_SYMBOL_DOT = \{ cx: ([\d.]+), cy: ([\d.]+), r: (\d+) \}/)
if (!pathMatch || !dotMatch) {
  throw new Error('Não foi possível extrair BRAND_SYMBOL_PATH/BRAND_SYMBOL_DOT de brand-symbol.ts')
}

const path = pathMatch[1]
const dot = { cx: dotMatch[1], cy: dotMatch[2], r: dotMatch[3] }

const buildSvg = ({ bg, stroke, dotColor }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${bg}"/>
  <path d="${path}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dotColor}"/>
</svg>`

const variants = {
  '': buildSvg({ bg: '#1A4E5C', stroke: '#FFFDF9', dotColor: '#DC805A' }), // principal
  '-inverted': buildSvg({ bg: '#FFFDF9', stroke: '#1A4E5C', dotColor: '#1A4E5C' }), // invertida
}

const outDir = join(root, 'brand')
mkdirSync(outDir, { recursive: true })

for (const [suffix, markup] of Object.entries(variants)) {
  writeFileSync(join(outDir, `educar-se-ia-symbol${suffix}.svg`), markup)
  for (const size of [512, 1024]) {
    await sharp(Buffer.from(markup)).resize(size, size).png().toFile(join(outDir, `educar-se-ia-symbol${suffix}-${size}.png`))
  }
  console.log(`✓ educar-se-ia-symbol${suffix} (.svg, 512x512, 1024x1024)`)
}
