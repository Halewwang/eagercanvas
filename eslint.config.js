import js from '@eslint/js'
import globals from 'globals'
import vue from 'eslint-plugin-vue'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'backend/**',
      'supabase/**'
    ]
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_BUILD_ID__: 'readonly',
        __APP_BUILD_TIME__: 'readonly'
      }
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-debugger': 'error',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'no-unused-vars': 'off',
      'preserve-caught-error': 'off',
      'vue/no-side-effects-in-computed-properties': 'off',
      'vue/multi-word-component-names': 'off'
    }
  }
]
