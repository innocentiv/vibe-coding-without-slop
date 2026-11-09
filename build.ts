/**
 * `bun run build`: src/deck.html → index.html, one self-contained file that runs offline.
 *
 * Inlines the stylesheet, the runtime, the numbers, the fonts and the screenshots, and the recorded
 * demo if `assets/mcp-demo.mp4` exists (otherwise its slide keeps the placeholder). Fails if any
 * reference to a file is left, so the built deck can never quietly depend on the folder beside it.
 */
import { extname, join, resolve } from 'node:path'

const ROOT = import.meta.dir
const SRC = join(ROOT, 'src')

const MIME: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
}

async function dataUri(path: string): Promise<string> {
  const file = Bun.file(path)
  if (!(await file.exists())) throw new Error(`Missing asset: ${path}`)
  const mime = MIME[extname(path)]
  if (mime === undefined) throw new Error(`No MIME type for ${path}`)
  return `data:${mime};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
}

/** Replace every match, awaiting each replacement in turn. */
async function replaceAsync(
  text: string,
  pattern: RegExp,
  replace: (...groups: string[]) => Promise<string>,
): Promise<string> {
  let out = ''
  let last = 0
  for (const match of text.matchAll(pattern)) {
    out += text.slice(last, match.index) + (await replace(...match))
    last = match.index + match[0].length
  }
  return out + text.slice(last)
}

let html = await Bun.file(join(SRC, 'deck.html')).text()

// Fonts, referenced from the stylesheet relative to src/.
let css = await Bun.file(join(SRC, 'deck.css')).text()
css = await replaceAsync(css, /url\('(\.\.\/assets\/[^']+)'\)/g, async (_, path = '') =>
  `url('${await dataUri(resolve(SRC, path))}')`,
)

const js = await Bun.file(join(SRC, 'deck.js')).text()
const numbers = JSON.stringify(await Bun.file(join(SRC, 'numbers.json')).json())

html = html.replace('<link rel="stylesheet" href="deck.css" />', () => `<style>\n${css}</style>`)
html = html.replace(
  '<script type="application/json" id="numbers" src="numbers.json"></script>',
  () => `<script type="application/json" id="numbers">${numbers}</script>`,
)
html = html.replace('<script src="deck.js"></script>', () => `<script>\n${js}</script>`)

// Screenshots.
html = await replaceAsync(html, /src="(\.\.\/assets\/[^"]+)"/g, async (_, path = '') =>
  `src="${await dataUri(resolve(SRC, path))}"`,
)

// The recorded demo, when there is one.
const demo = join(ROOT, 'assets', 'mcp-demo.mp4')
if (await Bun.file(demo).exists()) {
  html = await replaceAsync(
    html,
    /<div class="demo-slot" data-video="[^"]+">[\s\S]*?<\/div>\s*<\/div>/,
    async () =>
      `<div class="demo-slot"><video src="${await dataUri(demo)}" controls preload="auto" playsinline muted></video></div>`,
  )
}

const left = html.match(/(?:src|href)="(?!data:|https?:|#)[^"]+"|url\('(?!data:)[^']+'\)/g)
if (left !== null) throw new Error(`Still pointing at files: ${left.join(', ')}`)

await Bun.write(join(ROOT, 'index.html'), html)
const size = (Bun.file(join(ROOT, 'index.html')).size / 1024 / 1024).toFixed(1)
const slides = html.match(/<section class="slide/g)?.length ?? 0
console.log(`index.html: ${slides} slides, ${size} MB, self-contained.`)
