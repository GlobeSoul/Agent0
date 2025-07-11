// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nodePlugin from 'eslint-plugin-n';

export default tseslint.config(
  // ESLint's recommended rules
  eslint.configs.recommended,

  // TypeScript-specific recommended rules
  ...tseslint.configs.recommended,

  // Recommended rules for Node.js
  nodePlugin.configs['flat/recommended'],

  // TypeScript files with type checking
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
  },

    // Custom rule configurations
  {
    rules: {
      // General ESLint rules - enhanced for code quality
      'no-console': 'off', // Allow console statements for logging
      'complexity': ['warn', 15], // Warn on overly complex functions
      'prefer-const': 'error', // Prefer const over let when possible
      'no-var': 'error', // No var declarations
      'no-duplicate-imports': 'error', // Prevent duplicate imports
      'no-unused-expressions': 'error', // Prevent unused expressions
      'no-empty': 'warn', // Warn on empty blocks
      'no-useless-escape': 'warn', // Warn on unnecessary escapes

      // TypeScript-specific rule customizations (basic rules)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ], // Use type imports when possible

      // Node.js specific rule customizations
      'n/no-unsupported-features/es-syntax': [
        'error',
        {
          version: '>=22.0.0', // Match your package.json engines requirement
          ignores: ['modules'],
        },
      ],
      'n/no-missing-import': 'off', // Turn off as TypeScript handles this
      'n/no-unpublished-import': 'off', // Allow dev dependencies in configs
      'n/no-process-exit': 'off', // Allow process.exit in scripts and servers
      'n/prefer-global/process': 'error', // Use global process
      'n/prefer-global/buffer': 'error', // Use global Buffer
    },
  },
  {
    // TypeScript files with type-aware rules
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/prefer-optional-chain': 'error', // Use optional chaining
      '@typescript-eslint/prefer-nullish-coalescing': 'error', // Use ?? over ||
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn', // Warn on ! assertions
      '@typescript-eslint/require-await': 'warn', // Warn on async functions without await
      '@typescript-eslint/no-floating-promises': 'error', // Handle promises properly
      '@typescript-eslint/await-thenable': 'error', // Only await thenables
      '@typescript-eslint/no-misused-promises': 'error', // Prevent misused promises
    },
  },
  {
    // JSON files configuration
    files: ['**/*.json'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',
    },
  },
  {
    // Test files configuration
    files: ['**/*.test.ts', '**/test/**/*.ts', '**/__test__/**/*.ts', '**/__tests__/**/*.ts', '**/*.spec.ts'],
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow ! assertions in tests
      'complexity': 'off', // Allow complex test scenarios
      'n/no-unpublished-import': 'off', // Allow test dependencies
    },
  },
  {
    // File-specific configurations for config files
    files: ['**/*.config.{js,ts}', 'eslint.config.js', 'turbo.json'],
    rules: {
      'n/no-unpublished-import': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',
    },
  },
  {
    // Ignore files from the linting process
    ignores: [
      'dist/',
      'node_modules/',
      '.turbo/',
      'pnpm-lock.yaml',
      'package-lock.json',
      '**/*.d.ts',
      '.cursor/',
      '**/*.json',
      '.prettierrc',
      '.prettierrc.js',
    ],
  }
);
