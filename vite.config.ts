import { defineConfig } from 'vite'

// GitHub Pages project site: https://carterbkeeling.github.io/M3/
// Only index.html is a build input; lab.html is a dev-only blockout harness.
export default defineConfig({
  base: '/M3/',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
