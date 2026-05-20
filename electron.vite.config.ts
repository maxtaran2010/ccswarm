import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: 'src/main/index.ts' },
      rollupOptions: {
        output: { format: 'cjs' }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: 'src/preload/index.ts' },
      rollupOptions: {
        output: { format: 'cjs' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
})
