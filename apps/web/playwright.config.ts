/**
 * Playwright — configuração E2E
 *
 * Requisitos para rodar:
 *   - `supabase start` (DB local para auth)
 *   - `npm run dev --workspace=apps/api` (API na porta 3001)
 *   - `npm run dev --workspace=apps/web` (Next.js na porta 3000)
 *     OU usar reuseExistingServer: true e subir manualmente
 *
 * Rodar: npm run test:e2e (apps/web)
 * Relatório com vídeo: npx playwright show-report
 */

import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

/** Storage state salvo pelo global-setup — reutilizado em todos os testes autenticados */
export const STORAGE_STATE = path.join(__dirname, 'tests/e2e/.auth/user.json')

export default defineConfig({
  testDir: './tests/e2e',

  // Timeout por teste (plano demora pela mock de geração)
  timeout: 40_000,
  expect: { timeout: 8_000 },

  // Sem paralelismo — os testes compartilham estado de auth
  fullyParallel: false,
  workers: 1,

  // Retries só em CI
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',

    // Grava todos os testes — evidência para auditoria / INPI
    video: 'on',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // Setup global: cria usuário de teste + salva storage state de auth
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },

    // Testes autenticados dependem do setup
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: /global-(setup|teardown)\.ts/,
    },
  ],

  // Servidores locais — reutiliza se já estiverem rodando
  webServer: [
    {
      command: 'npm run dev --workspace=apps/api',
      port: 3001,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev --workspace=apps/web',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
