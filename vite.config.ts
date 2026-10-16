import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { expandBlocks } from './src/content/blocks.ts'
import { t } from './src/content/copy.ts'
import { SITE_URL } from './src/content/site.ts'

// GitHub Pages project site: https://carterbkeeling.github.io/M3/
// Only index.html is a build input; lab.html and wordmarks.html are dev-only harnesses.

// Static HTML generated from config.ts and the content modules, so the page keeps real text for
// SEO and no-JS while config.ts stays the single source.
function injectContent(): Plugin {
  return {
    name: 'm3-inject-content',
    transformIndexHtml: { order: 'pre', handler: expandBlocks },
  }
}

// Absolute share and canonical URLs (scrapers don't run JS, and Vite would make /og.png root-relative).
function headMeta(): Plugin {
  return {
    name: 'm3-head-meta',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'canonical', href: SITE_URL }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:url', content: SITE_URL }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image', content: `${SITE_URL}og.png` }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:image:alt', content: t('og.alt') }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE_URL}og.png` }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'twitter:image:alt', content: t('og.alt') }, injectTo: 'head' },
    ],
  }
}

// Production only: strip HTML comments (DRAFT markers never ship) and add a meta CSP.
// Dev keeps comments for review and needs inline <style> injection, so neither applies there.
function productionHtml(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'm3-production-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
    },
  }
}

// The stills, card art and OG image are rendered from the model (npm run render:assets) and stamped
// with a hash of config.ts. Warn at build time when config.ts has changed since they were rendered.
function staleAssets(): Plugin {
  return {
    name: 'm3-stale-assets',
    apply: 'build',
    buildStart() {
      const manifest = 'public/stills/manifest.json'
      const hash = createHash('sha256').update(readFileSync('src/model/config.ts')).digest('hex').slice(0, 16)
      const stamped = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, 'utf8')) as { configHash?: string }).configHash : undefined
      if (stamped !== hash) this.warn('Rendered stills and OG image are stale (config.ts changed). Run: npm run render:assets && npm run export:glb')
    },
  }
}

export default defineConfig({
  base: '/M3/',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  plugins: [injectContent(), headMeta(), productionHtml(), staleAssets()],
  // three.js is one lazy chunk (~150 kB gzipped) loaded after first paint.
  build: { chunkSizeWarningLimit: 700 },
})
