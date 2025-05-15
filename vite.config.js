import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/last-live/', // Replace 'last-live' with your repository name
  plugins: [react()],
})
