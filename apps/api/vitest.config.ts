import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.test', override: true })

// Dois perfis de teste:
//   npm run test            → unit + route tests (sem Supabase)
//   npm run test:integration → inclui src/__tests__/** (precisa de supabase start)
const isIntegration = process.env.TEST_MODE === 'integration'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      // Testes de integração real (precisam de Supabase local) ficam fora do run padrão
      ...(!isIntegration ? ['src/__tests__/**'] : []),
    ],
    testTimeout: 30000,
  },
})
