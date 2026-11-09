/**
 * `bun run refresh [path to cedo]`: recounts every number a slide takes from cedo's repository, and
 * stamps the commit and date the last slide footnotes. Run on 24 November, then `bun run build`.
 *
 * Counts only what git, the files and GitHub can say, each the way cedo's research note counted it
 * (docs/research/2026-11-bolognajs-talk.md, "Key numbers"). The session counts — questions,
 * reviewers, tokens — come from transcripts up to 9 November and stay as they are; so do #83's
 * findings, which are history.
 */
import { join, resolve } from 'node:path'
import { $ } from 'bun'

const ROOT = join(import.meta.dir, '..')
const CEDO = resolve(Bun.argv[2] ?? join(ROOT, '..', 'cedo'))
const NUMBERS = join(ROOT, 'src', 'numbers.json')
/** M0, the first commit: CLAUDE.md before any code. */
const M0 = '581a056'

const git = (...args: string[]) => $`git -C ${CEDO} ${args}`.text()
const count = (text: string) => text.split('\n').filter((line) => line.trim() !== '').length
const read = (path: string) => Bun.file(join(CEDO, path)).text()

const claude = await read('CLAUDE.md')
const notes = claude.split(/^## Working notes$/mu)[1]?.split(/^## /mu)[0] ?? ''
const tools = await $`git -C ${CEDO} grep -c "registerTool(" -- apps/api/src/mcp/tools`.text()
const journeys = await $`git -C ${CEDO} grep -cE "^\s*(test|it)\(" -- "apps/app/e2e/*.e2e.ts"`.text()
const sumCounts = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.includes(':'))
    .reduce((total, line) => total + Number(line.split(':').at(-1)), 0)
const lock: unknown = await Bun.file(join(CEDO, 'skills-lock.json')).json()
const skills =
  typeof lock === 'object' && lock !== null && 'skills' in lock && typeof lock.skills === 'object'
    ? Object.keys(lock.skills ?? {}).length
    : null

let issues: number | null = null
try {
  issues = count(await $`gh issue list --repo innocentiv/cedo --state all --limit 1000 --json number --jq .[].number`.text())
} catch {
  console.warn('gh could not list issues: git.issues left as it was.')
}

const fresh = {
  commits: Number((await git('rev-list', '--count', 'main')).trim()),
  activeDays: new Set((await git('log', 'main', '--format=%ad', '--date=short')).split('\n').filter(Boolean)).size,
  adrs: (await Array.fromAsync(new Bun.Glob('docs/adr/0*.md').scan({ cwd: CEDO }))).length,
  workingNotes: (notes.match(/^- \*\*/gmu) ?? []).length,
  claudeLines: claude.split('\n').length - 1,
  claudeLinesM0: (await git('show', `${M0}:CLAUDE.md`)).split('\n').length - 1,
  mcpTools: sumCounts(tools),
  e2eJourneys: sumCounts(journeys),
  ...(issues === null ? {} : { issues }),
}

const numbers = (await Bun.file(NUMBERS).json()) as {
  asOf: { commit: string; date: string }
  git: Record<string, number>
  skills: Record<string, number>
}
const before = JSON.stringify(numbers)

numbers.asOf = {
  commit: (await git('rev-parse', '--short', 'main')).trim(),
  date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
}
for (const [key, value] of Object.entries(fresh)) {
  if (numbers.git[key] !== value) console.log(`git.${key}: ${String(numbers.git[key])} → ${String(value)}`)
  numbers.git[key] = value
}
if (skills !== null && numbers.skills['pinned'] !== skills) {
  console.log(`skills.pinned: ${String(numbers.skills['pinned'])} → ${String(skills)}`)
  numbers.skills['pinned'] = skills
}

await Bun.write(NUMBERS, `${JSON.stringify(numbers, null, 2)}\n`)
console.log(
  before === JSON.stringify(numbers)
    ? 'No number changed.'
    : `Numbers as of ${numbers.asOf.commit}, ${numbers.asOf.date}. Now: bun run build`,
)
