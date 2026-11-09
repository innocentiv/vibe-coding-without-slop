/**
 * `bun run shoot`: every slide, at every step, as a PNG in .artifacts/slides/, and the presenter
 * view of slide 1, so the deck can be read back as pictures. Run `bun run build` first.
 */
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const OUT = join(ROOT, '.artifacts', 'slides')
const only = Bun.argv[2] === undefined ? null : Number(Bun.argv[2])

const server = Bun.serve({
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname
    return new Response(Bun.file(join(ROOT, path === '/' ? 'index.html' : path)))
  },
})

const errors: string[] = []
const view = new Bun.WebView({
  width: 1600,
  height: 900,
  console: (type: string, ...args: unknown[]) => {
    if (type === 'error' || type === 'warn') errors.push(args.map(String).join(' '))
  },
})

async function settle(): Promise<void> {
  await view.evaluate(`document.fonts.ready.then(() => true)`)
  // Builds fade in over 260 ms; a screenshot taken mid-fade is not what the room sees.
  await view.evaluate(
    `document.head.insertAdjacentHTML('beforeend', '<style>*{transition:none!important}</style>')`,
  )
}

try {
  await view.navigate(`${server.url}index.html#1`)
  await settle()
  const plan = JSON.parse(
    String(
      await view.evaluate(
        `JSON.stringify([...document.querySelectorAll('.deck > .slide')].map((s) => s.querySelectorAll('.step').length))`,
      ),
    ),
  ) as number[]

  let count = 0
  for (const [i, steps] of plan.entries()) {
    if (only !== null && i + 1 !== only) continue
    for (let k = 0; k <= steps; k++) {
      await view.evaluate(`location.hash = '#${i + 1}.${k}'`)
      await settle()
      const name = `${String(i + 1).padStart(2, '0')}${steps > 0 ? `-${k}` : ''}.png`
      await Bun.write(join(OUT, name), await view.screenshot())
      count++
    }
  }

  if (only === null) {
    await view.navigate(`${server.url}index.html?presenter#7.1`)
    await settle()
    await Bun.write(join(OUT, 'presenter.png'), await view.screenshot())
    count++
  }
  console.log(`${count} screenshots in .artifacts/slides/`)
  if (errors.length > 0) console.log(`Console:\n  ${errors.join('\n  ')}`)
} finally {
  view.close()
  void server.stop()
}
process.exit(0)
