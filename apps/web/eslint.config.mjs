import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // next.config.js must stay CommonJS for Next.js to load it.
    files: ['next.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // react-hooks v7's set-state-in-effect targets React 19/Compiler
      // patterns; it flags the standard React 18 "fetch in effect with a
      // loading flag" shape used throughout this codebase. Keep as a
      // warning until the data-fetching pattern is revisited.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default config
