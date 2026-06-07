import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/birthday-quest/',   // ← MUST match your GitHub repo name exactly
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000,
  }
})
