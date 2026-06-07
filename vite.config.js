import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ⚠️  Change 'birthday-quest' to match your GitHub repo name exactly
  base: '/birthday-quest/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000,
  }
})
