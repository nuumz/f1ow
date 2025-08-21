import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'

export default [
  {
    ignores: ['dist', 'build', 'coverage', 'node_modules']
  },
  // TypeScript - application source
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      }
    },
    plugins: {
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', {
        prefer: 'type-imports'
      }],
      'no-eval': 'error',
      'no-console': ['warn', {
        allow: ['warn', 'error']
      }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'object-shorthand': 'warn',
      'prefer-template': 'warn',
      'no-nested-ternary': 'warn',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all']
    }
  },
  // TypeScript - config/test files
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.node.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  // JavaScript files (no TS project service)
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'object-shorthand': 'warn',
      'prefer-template': 'warn',
      'no-nested-ternary': 'warn',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all']
    }
  }
]