// Lighthouse scores for the production build: npm run lh (node scripts/lighthouse.ts).
//
// - Expects `vite preview` at http://localhost:4173/M3/ (the CSP build). If nothing is listening there,
//   it runs `vite build` + `vite preview --port 4173 --strictPort` itself and stops that preview at the end.
// - Launches the installed Edge HEADED (real GPU) through Playwright with a DevTools port, and points
//   Lighthouse at that port. Headless or software GL would score the no-WebGL fallback by mistake.
// - Desktop preset × 3 (median gated: Performance ≥ 80, Accessibility ≥ 95) + one mobile run (reported only).
// - After each run it opens the page in the same browser and fails (exit 1) unless
//   document.documentElement.dataset.gl === 'webgl2'.
// - Writes reports/lh-desktop-<n>.html/.json, reports/lh-mobile.html/.json and reports/lh-summary.json.
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { chromium, type Browser } from '@playwright/test'
import lighthouse, { type Config, type Flags, type Result } from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const URL = 'http://localhost:4173/M3/'
const CDP_PORT = 9333
const DESKTOP_RUNS = 3
const GATE = { performance: 80, accessibility: 95 }
const OUT = path.resolve('reports')
// Project-local temp dir (inside node_modules, so neither git nor the Vite watcher sees it). Works around
// the Windows EPERM failure when a browser profile in %TEMP% is still locked during cleanup.
const TMP = path.resolve('node_modules', '.tmp', 'lighthouse')

interface RunSummary {
  run: string
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
  lcpMs: number | null
  tbtMs: number | null
  cls: number | null
  gl: string | null // dataset.gl seen in the same browser right after the run
  stageChunkLoaded: boolean // the WebGL stage chunk was requested during the Lighthouse run itself
  runtimeError?: string
  warnings: string[]
}

// ---- helpers ------------------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitUp(url: string, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await isUp(url)) return true
    await sleep(500)
  }
  return false
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

// Node runs Vite's own bin directly (no npx/shell), so the preview is one process that kill() stops.
const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js')

function runToEnd(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteBin, ...args], { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite ${args[0]} exited with ${code}`))))
  })
}

async function startPreview(): Promise<ChildProcess> {
  console.log('No preview at', URL, '→ building and starting one.')
  await runToEnd(['build'])
  const child = spawn(process.execPath, [viteBin, 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' })
  if (!(await waitUp(URL, 30_000))) {
    child.kill()
    throw new Error(`vite preview did not come up at ${URL}`)
  }
  return child
}

const score = (lhr: Result, id: string) => {
  const s = lhr.categories[id]?.score
  return typeof s === 'number' ? Math.round(s * 100) : null
}
const numeric = (lhr: Result, id: string) => {
  const v = lhr.audits[id]?.numericValue
  return typeof v === 'number' ? v : null
}

// The 3D stage is a lazy chunk that main.ts imports only when WebGL2 (hardware) is available, so its
// request in the run's own network log shows the scored load took the WebGL branch. (Informational:
// the chunk can load and still fail to start; the dataset.gl check is the gate.)
function stageChunkLoaded(lhr: Result): boolean {
  const details = lhr.audits['network-requests']?.details as { items?: Array<{ url?: string }> } | undefined
  return (details?.items ?? []).some((i) => /\/assets\/stage[^/]*\.js(\?|$)/.test(i.url ?? ''))
}

async function glCheck(browser: Browser): Promise<{ gl: string | null; renderer: string }> {
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } })
  try {
    const page = await ctx.newPage()
    await page.goto(URL, { waitUntil: 'load' })
    // main.ts sets dataset.gl once the stage has booted ('webgl2') or the fallback is chosen ('none').
    // It stays unset if the stage throws while starting, which also fails the check.
    await page.waitForFunction(() => document.documentElement.dataset.gl, null, { timeout: 30_000 }).catch(() => {})
    return await page.evaluate(() => {
      let renderer = ''
      try {
        const gl = document.createElement('canvas').getContext('webgl2')
        const info = gl?.getExtension('WEBGL_debug_renderer_info')
        if (gl && info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
        gl?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        /* reported as empty */
      }
      return { gl: document.documentElement.dataset.gl ?? null, renderer }
    })
  } finally {
    await ctx.close()
  }
}

async function runLighthouse(name: string, config: Config | undefined, browser: Browser) {
  const flags: Flags = {
    port: CDP_PORT,
    hostname: '127.0.0.1',
    output: ['html', 'json'],
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  }
  const result = await lighthouse(URL, flags, config)
  if (!result) throw new Error(`Lighthouse returned no result for ${name}`)
  const [html, json] = Array.isArray(result.report) ? result.report : [result.report, JSON.stringify(result.lhr)]
  writeFileSync(path.join(OUT, `lh-${name}.html`), html)
  writeFileSync(path.join(OUT, `lh-${name}.json`), json)
  const lhr = result.lhr
  const { gl, renderer } = await glCheck(browser)
  const summary: RunSummary = {
    run: name,
    performance: score(lhr, 'performance'),
    accessibility: score(lhr, 'accessibility'),
    bestPractices: score(lhr, 'best-practices'),
    seo: score(lhr, 'seo'),
    lcpMs: numeric(lhr, 'largest-contentful-paint'),
    tbtMs: numeric(lhr, 'total-blocking-time'),
    cls: numeric(lhr, 'cumulative-layout-shift'),
    gl,
    stageChunkLoaded: stageChunkLoaded(lhr),
    warnings: lhr.runWarnings.map(String),
    ...(lhr.runtimeError ? { runtimeError: `${lhr.runtimeError.code}: ${lhr.runtimeError.message}` } : {}),
  }
  return { summary, renderer, userAgent: lhr.environment.hostUserAgent }
}

function median(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => typeof x === 'number').sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

const fmt = (r: Pick<RunSummary, 'performance' | 'accessibility' | 'bestPractices' | 'seo' | 'lcpMs' | 'tbtMs' | 'cls'>) =>
  [
    `Perf ${r.performance ?? '–'}`,
    `A11y ${r.accessibility ?? '–'}`,
    `BP ${r.bestPractices ?? '–'}`,
    `SEO ${r.seo ?? '–'}`,
    `LCP ${r.lcpMs === null ? '–' : `${(r.lcpMs / 1000).toFixed(2)} s`}`,
    `TBT ${r.tbtMs === null ? '–' : `${Math.round(r.tbtMs)} ms`}`,
    `CLS ${r.cls === null ? '–' : r.cls.toFixed(3)}`,
  ].join(' · ')

// ---- main ---------------------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP

let preview: ChildProcess | undefined
let browser: Browser | undefined
const stopPreview = () => {
  if (preview && preview.exitCode === null) preview.kill()
}
process.once('SIGINT', () => {
  stopPreview()
  process.exit(130)
})

const desktop: RunSummary[] = []
const summary = {
  url: URL,
  date: new Date().toISOString(),
  pass: false,
  error: null as string | null,
  browser: '',
  userAgent: '',
  webglRenderer: '',
  desktop: {
    preset: 'lighthouse/core/config/desktop-config.js',
    runs: desktop,
    median: null as Record<'performance' | 'accessibility' | 'bestPractices' | 'seo' | 'lcpMs' | 'tbtMs' | 'cls', number | null> | null, // per-metric medians
    gate: { ...GATE, pass: false, failures: [] as string[] },
  },
  mobile: { preset: 'lighthouse default (mobile)', gated: false, run: null as RunSummary | null },
}

try {
  if (!(await isUp(URL))) preview = await startPreview()
  else console.log('Using the preview already running at', URL)

  if (!(await portFree(CDP_PORT))) throw new Error(`Port ${CDP_PORT} is busy; close whatever uses it and rerun.`)
  browser = await chromium.launch({ channel: 'msedge', headless: false, args: [`--remote-debugging-port=${CDP_PORT}`] })
  if (!(await waitUp(`http://127.0.0.1:${CDP_PORT}/json/version`, 15_000))) {
    throw new Error(`Edge did not open its DevTools port ${CDP_PORT}`)
  }
  summary.browser = `Microsoft Edge ${browser.version()} (headed, via Playwright)`
  console.log(`Edge ${browser.version()} (headed) on DevTools port ${CDP_PORT}`)

  for (let n = 1; n <= DESKTOP_RUNS; n++) {
    const r = await runLighthouse(`desktop-${n}`, desktopConfig, browser)
    summary.webglRenderer ||= r.renderer
    summary.userAgent ||= r.userAgent
    desktop.push(r.summary)
    console.log(`desktop ${n}/${DESKTOP_RUNS}: ${fmt(r.summary)} · gl=${r.summary.gl} · stage chunk ${r.summary.stageChunkLoaded ? 'loaded' : 'NOT loaded'}`)
    if (r.summary.runtimeError) console.log(`  runtime error: ${r.summary.runtimeError}`)
    if (r.summary.gl !== 'webgl2') {
      throw new Error(
        `WebGL check failed after desktop run ${n}: dataset.gl = ${r.summary.gl ?? '(unset)'} (GPU "${r.renderer}"). ` +
          `The 3D stage did not boot, so these scores are not of the WebGL page; stopping.`,
      )
    }
  }

  const med = {
    performance: median(desktop.map((r) => r.performance)),
    accessibility: median(desktop.map((r) => r.accessibility)),
    bestPractices: median(desktop.map((r) => r.bestPractices)),
    seo: median(desktop.map((r) => r.seo)),
    lcpMs: median(desktop.map((r) => r.lcpMs)),
    tbtMs: median(desktop.map((r) => r.tbtMs)),
    cls: median(desktop.map((r) => r.cls)),
  }
  const failures = summary.desktop.gate.failures
  if ((med.performance ?? 0) < GATE.performance) failures.push(`Performance ${med.performance} < ${GATE.performance}`)
  if ((med.accessibility ?? 0) < GATE.accessibility) failures.push(`Accessibility ${med.accessibility} < ${GATE.accessibility}`)
  summary.desktop.median = med
  summary.desktop.gate.pass = failures.length === 0

  // Mobile preset (Lighthouse default config): reported, not gated.
  const mobile = await runLighthouse('mobile', undefined, browser)
  summary.mobile.run = mobile.summary
  console.log(`mobile (not gated): ${fmt(mobile.summary)} · gl=${mobile.summary.gl} · stage chunk ${mobile.summary.stageChunkLoaded ? 'loaded' : 'NOT loaded'}`)

  console.log(`\nDesktop median of ${DESKTOP_RUNS}: ${fmt(med)}`)
  console.log(`WebGL renderer: ${summary.webglRenderer || '(unknown)'}`)
  summary.pass = summary.desktop.gate.pass
  if (failures.length) {
    console.error(`\nFAIL (desktop gate): ${failures.join('; ')}`)
    process.exitCode = 1
  } else {
    console.log(`\nPASS: desktop median Performance ≥ ${GATE.performance} and Accessibility ≥ ${GATE.accessibility}`)
  }
} catch (err) {
  summary.error = err instanceof Error ? err.message : String(err)
  console.error(`\nFAIL: ${summary.error}`)
  process.exitCode = 1
} finally {
  writeFileSync(path.join(OUT, 'lh-summary.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`Reports: ${path.relative(process.cwd(), OUT)}${path.sep}lh-*.html|json and lh-summary.json`)
  await browser?.close().catch(() => {})
  stopPreview()
  try {
    rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  } catch {
    // A still-locked profile file (Windows EPERM) is left for the next run; it is inside node_modules/.tmp.
  }
}
