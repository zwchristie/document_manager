import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib'
  
  return {
    plugins: [
      react(),
      ...(isLib ? [dts({ include: ['src', 'components', 'services', 'types', 'utils'] })] : [])
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@/components': resolve(__dirname, './components'),
        '@/services': resolve(__dirname, './services'),
        '@/types': resolve(__dirname, './types'),
        '@/utils': resolve(__dirname, './utils')
      }
    },
    build: isLib ? {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'DocumentManager',
        formats: ['es', 'umd'],
        fileName: (format) => `document-manager.${format}.js`
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM'
          }
        }
      }
    } : undefined,
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts']
    }
  }
})