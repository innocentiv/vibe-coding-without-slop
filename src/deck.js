/*
 * The deck's runtime. No dependencies, works from file:// and offline.
 *
 * Keys, in either window:
 *   → Space PageDown   next step, then next slide
 *   ← PageUp           back
 *   Home End           first, last
 *   digits then Enter  go to that slide
 *   P                  open the presenter view in a second window
 *   F                  full screen
 *   B                  black screen
 *   ?                  these keys
 *
 * The audience window and the presenter window follow each other over a BroadcastChannel, so
 * either can drive. The presenter view is this same file opened with ?presenter.
 */
;(() => {
  const STAGE = { width: 1600, height: 900 }
  const CHANNEL = 'vibe-coding-without-slop'
  const presenter = new URLSearchParams(location.search).has('presenter')

  const deck = document.querySelector('.deck')
  const slides = [...document.querySelectorAll('.deck > .slide')]
  const total = slides.length

  // ——— Numbers: every figure on a slide is data, refreshed by scripts/refresh-numbers.ts ———

  const numbers = JSON.parse(document.getElementById('numbers')?.textContent ?? '{}')
  for (const el of document.querySelectorAll('[data-n]')) {
    const value = el.dataset.n.split('.').reduce((at, key) => at?.[key], numbers)
    el.textContent = value === undefined ? `{${el.dataset.n}}` : String(value)
    if (value === undefined) console.warn(`No number for ${el.dataset.n}`)
  }

  // ——— Slide numbers ———

  const mainCount = slides.filter((s) => !s.classList.contains('backup')).length
  slides.forEach((slide, i) => {
    const n = document.createElement('div')
    n.className = 'slide-number'
    n.textContent = slide.classList.contains('backup') ? `B${i - mainCount + 1}` : `${i + 1}`
    slide.append(n)
  })

  // ——— State: slide index and step within it ———

  const stepsOf = (slide) => [...slide.querySelectorAll('.step')]
  let index = 0
  let step = 0

  function parseHash() {
    const [s, k] = location.hash.replace('#', '').split('.')
    const i = Math.min(Math.max(Number(s) - 1 || 0, 0), total - 1)
    const max = stepsOf(slides[i]).length
    return { i, k: Math.min(Math.max(Number(k) || 0, 0), max) }
  }

  function render(target = document) {
    const scope = target === document ? slides : [...target.querySelectorAll('.slide')]
    scope.forEach((slide) => slide.classList.toggle('current', slide === slides[index]))
    showSteps(slides[index], step)
  }

  /**
   * A step is hidden until its turn, unless it flips: `data-flip="gap"` keeps the element on
   * screen and removes that class when its turn comes, so slide 14's gaps show red, then green.
   */
  function showSteps(slide, k) {
    stepsOf(slide).forEach((el, n) => {
      const flip = el.dataset.flip
      if (flip) el.classList.toggle(flip, n >= k)
      else el.classList.toggle('pending', n >= k)
    })
  }

  function go(i, k, { broadcast = true } = {}) {
    index = Math.min(Math.max(i, 0), total - 1)
    step = Math.min(Math.max(k, 0), stepsOf(slides[index]).length)
    const hash = `#${index + 1}${step > 0 ? `.${step}` : ''}`
    if (location.hash !== hash) history.replaceState(null, '', hash)
    render()
    if (presenter) renderPresenter()
    if (broadcast) channel?.postMessage({ type: 'go', index, step })
  }

  function next() {
    if (step < stepsOf(slides[index]).length) go(index, step + 1)
    else if (index < total - 1) go(index + 1, 0)
  }

  function previous() {
    if (step > 0) go(index, step - 1)
    else if (index > 0) go(index - 1, stepsOf(slides[index - 1]).length)
  }

  // ——— Scaling the 1600 × 900 stage to the window ———

  function fit() {
    const scale = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height)
    document.documentElement.style.setProperty('--scale', String(scale))
  }

  // ——— Sync between the two windows ———

  let channel = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = ({ data }) => {
      if (data?.type === 'go') go(data.index, data.step, { broadcast: false })
      if (data?.type === 'hello') channel.postMessage({ type: 'go', index, step })
      if (data?.type === 'black') deck.classList.toggle('blackout', data.on)
    }
  } catch {
    channel = null
  }

  // ——— Keys ———

  let typed = ''
  addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key
    if (/^[0-9]$/.test(key)) {
      typed += key
      return
    }
    if (key === 'Enter' && typed !== '') {
      go(Number(typed) - 1, 0)
      typed = ''
      return
    }
    typed = ''
    if (['ArrowRight', ' ', 'PageDown', 'ArrowDown'].includes(key)) next()
    else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(key)) previous()
    else if (key === 'Home') go(0, 0)
    else if (key === 'End') go(total - 1, 0)
    else if (key === 'p' || key === 'P') openPresenter()
    else if (key === 'f' || key === 'F') toggleFullscreen()
    else if (key === 'b' || key === 'B') toggleBlack()
    else if (key === '?') document.querySelector('.help')?.classList.toggle('open')
    else return
    event.preventDefault()
  })

  function openPresenter() {
    if (presenter) return
    const url = new URL(location.href)
    url.search = '?presenter'
    window.open(url.href, 'presenter', 'width=1400,height=900')
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  function toggleBlack() {
    const on = !deck.classList.contains('blackout')
    deck.classList.toggle('blackout', on)
    channel?.postMessage({ type: 'black', on })
  }

  // ——— The presenter view: this slide, the next one, the notes, and the clock ———

  const plan = slides.map((s) => Number(s.dataset.minutes) || 0)
  const plannedTotal = plan.reduce((a, b) => a + b, 0)
  let started = null

  const pad = (n) => String(n).padStart(2, '0')
  const clock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${pad(s % 60)}`
  }

  function buildPresenter() {
    const root = document.querySelector('.presenter')
    root.innerHTML = `
      <div class="clock">
        <span>Elapsed <strong data-elapsed>0:00</strong></span>
        <span>Plan here <strong data-planned>0:00</strong></span>
        <span data-drift></span>
        <span>of ${clock(plannedTotal * 60000)}</span>
        <button type="button" data-start>Start clock</button>
      </div>
      <div class="views">
        <div><div class="label">Now</div><div class="view now"></div></div>
        <div><div class="label">Next</div><div class="view next"></div></div>
      </div>
      <div class="notes-pane"></div>`
    root.querySelector('[data-start]').addEventListener('click', (e) => {
      started = Date.now()
      e.currentTarget.textContent = 'Restart clock'
      e.currentTarget.blur()
    })
    setInterval(tick, 500)
  }

  function mount(container, slide, k) {
    container.innerHTML = ''
    if (!slide) return
    const clone = slide.cloneNode(true)
    clone.classList.add('current')
    showSteps(clone, k)
    const scale = container.clientWidth / STAGE.width
    clone.style.transform = `translate(-50%, -50%) scale(${scale})`
    container.append(clone)
  }

  function renderPresenter() {
    const root = document.querySelector('.presenter')
    mount(root.querySelector('.view.now'), slides[index], step)
    const hasMoreSteps = step < stepsOf(slides[index]).length
    mount(
      root.querySelector('.view.next'),
      hasMoreSteps ? slides[index] : slides[index + 1],
      hasMoreSteps ? step + 1 : 0,
    )
    const slide = slides[index]
    const notes = slide.querySelector('.notes')
    const title = slide.dataset.title ?? ''
    const minutes = plan[index]
    root.querySelector('.notes-pane').innerHTML = `
      <h4>${index + 1}. ${title}</h4>
      <div class="budget">${minutes ? `${minutes} min` : 'backup'}${
        stepsOf(slide).length ? `, step ${step} of ${stepsOf(slide).length}` : ''
      }</div>
      <div class="notes" lang="it">${notes ? notes.innerHTML : ''}</div>`
    tick()
  }

  function tick() {
    const root = document.querySelector('.presenter')
    const elapsed = started === null ? 0 : Date.now() - started
    const plannedHere = plan.slice(0, index).reduce((a, b) => a + b, 0) * 60000
    root.querySelector('[data-elapsed]').textContent = clock(elapsed)
    root.querySelector('[data-planned]').textContent = clock(plannedHere)
    const drift = root.querySelector('[data-drift]')
    if (started === null) {
      drift.textContent = ''
      return
    }
    const delta = elapsed - plannedHere
    drift.className = delta > 30000 ? 'behind' : delta < -30000 ? 'ahead' : ''
    drift.textContent =
      Math.abs(delta) < 30000 ? 'on time' : `${clock(Math.abs(delta))} ${delta > 0 ? 'behind' : 'ahead'}`
  }

  // ——— Start ———

  if (presenter) {
    document.body.classList.add('is-presenter')
    document.title = `Presenter: ${document.title}`
    buildPresenter()
    addEventListener('resize', renderPresenter)
  } else {
    fit()
    addEventListener('resize', fit)
  }

  const { i, k } = parseHash()
  go(i, k, { broadcast: false })
  addEventListener('hashchange', () => {
    const at = parseHash()
    go(at.i, at.k)
  })
  channel?.postMessage({ type: 'hello' })
})()
