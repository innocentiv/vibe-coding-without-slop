# Vibe coding without slop

The slides for a 28-minute talk at BolognaJS on 25 November 2026: *what kept an agent-built app
honest*. The app is [cedo](https://github.com/innocentiv/cedo), a self-hosted workout tracker built
almost entirely by Claude Code. The talk's research, the evidence behind every claim on a slide,
is in cedo's `docs/research/2026-11-bolognajs-talk.md`.

**The deck is `index.html`: one file, no network, nothing to install.** Open it in a browser.

## Presenting

| Key | Does |
| --- | --- |
| → Space PageDown | next build step, then the next slide |
| ← PageUp | back |
| `P` | opens the presenter view in a second window: this slide, the next, the notes, the clock |
| `F` | full screen |
| `B` | black screen |
| `12` Enter | slide 12 |
| `?` | these keys |

The two windows follow each other, so either can drive. The presenter view's clock starts when you
press **Start clock**, and says how far ahead or behind the plan you are; each slide carries its
minutes (`data-minutes`). The notes are in Italian, as key phrases with timing marks; the opening,
the thesis, the turn to #68 and the close are written out in full.

Slides 1 to 18 are the talk; B1 to B7 are backups for questions.

**Slide 10 is live**: the lint refusal, run in a terminal on a cedo checkout. Its recorded output
is the slide's next step, if the live run fails. **Slide 16 plays a recording** of an AI reviewing
a week of training through cedo's MCP server: see `docs/runbook-mcp-demo.md`. Until
`assets/mcp-demo.mp4` exists, the slide shows a placeholder.

## Building

```bash
bun run build     # src/ → index.html, everything inlined
bun run shoot     # every slide, at every step, to .artifacts/slides/*.png
bun run shoot 14  # one slide
```

Edit `src/deck.html` (slides and notes), `src/deck.css` and `src/deck.js`; never `index.html`, which
the build writes. The build fails if anything is left pointing at a file.

## The numbers

Every figure on a slide that the repository can count comes from `src/numbers.json`, and a slide
names it with `data-n="git.commits"`. On 24 November:

```bash
bun run refresh   # recounts from a cedo checkout beside this one, then rebuild
```

It recounts what git and GitHub can say, and stamps the commit and date the last slide footnotes.
The session counts (questions asked, reviewers spawned, tokens) come from Claude Code's session
transcripts up to 9 November and are not recounted.

## Design

cedo's own visual language: the rubber floor, chalk, and the calibrated plates, each with one
meaning on every slide. Yellow is the point, red is what went wrong, green is what held, blue is the
agent's part. Barlow Condensed and Barlow, cedo's faces, embedded (SIL Open Font License,
`assets/fonts/OFL.txt`).

The screenshots on slide 3 are of a demo instance seeded with an invented athlete, never of a real
one.
