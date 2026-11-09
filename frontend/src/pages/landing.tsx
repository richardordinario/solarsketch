import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { SunMark } from '@/components/app/sun-mark'
import { CATALOG } from '@/engine/catalog'
import { SHOWCASE_CLEAR, showcaseDay, showcaseHour, shotAt, stateAt, SHOWCASE_TEMPLATE } from '@/engine/showcase-day'
import { compute } from '@/engine/simulation'
import { AUTHOR } from '@/lib/credits'
import { href } from '@/lib/router'
import { newFromTemplate } from '@/store/project-actions'
import { useT } from '@/i18n'

import './landing.css'

const Showcase3D = lazy(() => import('@/components/lab3d/lab-3d').then((m) => ({ default: m.Showcase3D })))

const COMPONENT_TYPES = Object.keys(CATALOG).length

/** Minutes between HUD updates while scrolling (the 3D camera and sun move continuously). */
const HUD_STEP = 5

const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`
const watts = (w: number) => (Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`)

/** Chapters, each pinned to the clock time the page reaches while it is on screen. */
const CHAPTERS: { at: string; kicker: string; title: string; body: string; extra?: 'stages' | 'formula' | 'faults' }[] = [
  {
    at: '06:00',
    kicker: 'First light',
    title: 'Sketch the whole system on one sheet.',
    body: 'Drag PV modules, charge controllers, batteries, inverters, breakers and loads onto a 2D sheet, then wire them terminal to terminal. Every component carries its own ratings.',
  },
  {
    at: '09:00',
    kicker: 'Morning check',
    title: 'A line is not a connection until it passes.',
    body: 'Every wire goes through six checks, in order. When one fails, you get the reason and the fix in plain words, not an error code.',
    extra: 'stages',
  },
  {
    at: '12:00',
    kicker: 'High noon',
    title: 'Run the day and watch the energy move.',
    body: 'This hybrid system puts solar first, fills the battery, sends the surplus to the grid, and leans on the grid once the battery reaches its 20 % reserve. The readings on this page come from the same engine.',
    extra: 'formula',
  },
  {
    at: '15:00',
    kicker: 'Afternoon shift',
    title: 'Break it on purpose. Then find the fault.',
    body: 'Troubleshooting challenges hide a fault in a working system. Follow the symptoms with a multimeter, a clamp meter and an insulation tester, and name the cause.',
    extra: 'faults',
  },
  {
    at: '17:30',
    kicker: 'Golden hour',
    title: 'See every load the system carries.',
    body: 'The same project stands up in 3D: the array on the roof, the inverter and battery on the wall, every cable routed to the loads it feeds. Day turns to night with the simulation clock.',
  },
]

const hourOf = (at: string) => +at.slice(0, 2) + +at.slice(3) / 60

const STAGES = ['Terminal', 'AC/DC domain', 'Polarity', 'Ratings', 'Topology', 'Protection']

/** Marks `[data-reveal]` children as in view once, for the CSS rise-in. */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.setAttribute('data-reveal', 'in')
            io.unobserve(e.target)
          }
      },
      { root: el, threshold: 0.2 },
    )
    el.querySelectorAll('[data-reveal]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [root])
}

function Readout({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-(--hair) py-1.5">
      <span className="text-[11px] tracking-[.12em] text-(--paper-dim) uppercase">{label}</span>
      <span className="mono text-[13px] font-medium tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  )
}

/** The sun's path from 06:00 to 18:00, with the sun at the current hour (below the horizon at night). */
function SunArc({ hour }: { hour: number }) {
  const a = Math.PI * (1 - (hour - 6) / 12)
  const up = hour > 6 && hour < 18
  return (
    <svg viewBox="0 0 56 34" className="h-[34px] w-14 flex-none" aria-hidden>
      <path d="M4 28 A24 24 0 0 1 52 28" fill="none" stroke="var(--hair)" strokeDasharray="2 3" />
      <line x1="0" y1="28" x2="56" y2="28" stroke="var(--paper-dim)" strokeOpacity=".5" />
      <circle cx={28 + Math.cos(a) * 24} cy={up ? 28 - Math.sin(a) * 24 : 31} r="3.5" fill={up ? 'var(--sun)' : 'var(--paper-dim)'} />
    </svg>
  )
}

function Chapter({ c, i }: { c: (typeof CHAPTERS)[number]; i: number }) {
  const T = useT()
  const focus = shotAt(hourOf(c.at)).label
  return (
    <section data-hour={hourOf(c.at)} className="flex min-h-[115dvh] items-end px-4 pb-6 sm:items-center sm:px-10 sm:pb-0 lg:px-16" aria-labelledby={`ch-${i}`}>
      <div data-reveal className={`landing-glass w-full max-w-[520px] p-6 sm:p-8`}>
        <div className="mb-5 flex items-center gap-3">
          <span className="mono text-[28px] leading-none font-light text-(--sun) tabular-nums">{c.at}</span>
          <span className="h-px flex-1 bg-(--hair)" />
          <span className="text-[11px] tracking-[.18em] text-(--paper-dim) uppercase">
            {String(i + 1).padStart(2, '0')} · {T(c.kicker)}
          </span>
        </div>
        <h2 id={`ch-${i}`} className="display m-0 text-[30px] leading-[1.08] sm:text-[38px]">
          {T(c.title)}
        </h2>
        <p className="mt-4 mb-0 text-[15px] leading-relaxed text-pretty text-(--paper-dim)">{T(c.body)}</p>
        {focus && (
          <div className="mono mt-5 flex items-center gap-2 text-[11px] tracking-[.14em] text-(--paper-dim) uppercase">
            <span className="inline-block size-2 bg-(--sun)" />
            {T('In focus')} · {T(focus)}
          </div>
        )}
        {c.extra === 'stages' && (
          <ol className="mono m-0 mt-6 grid list-none grid-cols-2 gap-px bg-(--hair) p-0 text-[12px] sm:grid-cols-3">
            {STAGES.map((s, k) => (
              <li key={s} className="flex items-center gap-2 bg-(--ink-2) px-3 py-2.5">
                <span className="text-(--sun)">{k + 1}</span>
                {T(s)}
              </li>
            ))}
          </ol>
        )}
        {c.extra === 'formula' && (
          <div className="mono mt-6 border border-(--hair) bg-(--ink-2) px-4 py-3 text-[14px]">
            P<sub>PV</sub> = P<sub>STC</sub> × (G ÷ 1000) × f
            <div className="mt-1 text-[11px] text-(--paper-dim)">{T('A simplified model for learning. Its assumptions are shown in the lab.')}</div>
          </div>
        )}
        {c.extra === 'faults' && (
          <div className="mono mt-6 grid grid-cols-3 gap-px bg-(--hair) text-center text-[11px]">
            {[
              ['V', 'Multimeter'],
              ['A', 'Clamp meter'],
              ['MΩ', 'Insulation'],
            ].map(([u, l]) => (
              <div key={l} className="bg-(--ink-2) px-2 py-3">
                <div className="text-[20px] text-(--sun)">{u}</div>
                <div className="mt-1 text-(--paper-dim)">{T(l)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function LandingPage() {
  const T = useT()
  const day = useMemo(() => showcaseDay(), [])
  const scroller = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const [minute, setMinute] = useState(showcaseHour(0) * 60)
  useReveal(scroller)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => {
      // Clock keyframes: the top of the page, each chapter centred on screen at its own time, and
      // the closing section at dusk. Between them the clock (and the camera) move linearly.
      const vh = el.clientHeight
      const base = el.getBoundingClientRect().top - el.scrollTop
      const top = (c: HTMLElement) => c.getBoundingClientRect().top - base
      const keys: [number, number][] = [[0, showcaseHour(0)]]
      el.querySelectorAll<HTMLElement>('[data-hour]').forEach((c) => keys.push([top(c) + c.offsetHeight / 2 - vh / 2, +c.dataset.hour!]))
      const end = el.querySelector<HTMLElement>('[data-dusk]')
      keys.push([end ? top(end) - vh * 0.6 : el.scrollHeight - vh, showcaseHour(1)])
      const y = el.scrollTop
      let hour = keys[keys.length - 1][1]
      for (let i = 1; i < keys.length; i++)
        if (y < keys[i][0]) {
          const [y0, h0] = keys[i - 1]
          const [y1, h1] = keys[i]
          hour = h0 + ((h1 - h0) * Math.max(0, y - y0)) / Math.max(1, y1 - y0)
          break
        }
      progress.current = (hour - showcaseHour(0)) / (showcaseHour(1) - showcaseHour(0))
      setMinute(Math.round((hour * 60) / HUD_STEP) * HUD_STEP)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const sim = stateAt(day, minute / 60)
  const live = useMemo(() => compute(sim, day.v, SHOWCASE_CLEAR), [sim, day.v])
  const p = (minute / 60 - 5.5) / 13.5
  const shot = shotAt(minute / 60)
  const pv = live.ppv
  const bat = live.ac.hybBattery
  const grid = live.ac.pgrid
  const kwp = day.nodes.reduce((a, n) => a + (n.specs.ratedPower ?? 0), 0) / 1000

  return (
    <div ref={scroller} className="landing relative h-full overflow-x-hidden overflow-y-auto">
      {/* Stage: the 3D house stays put while the story scrolls over it. */}
      <div className="sticky top-0 -mb-[100dvh] h-[100dvh] overflow-hidden">
        <Suspense fallback={<div className="h-full bg-[radial-gradient(ellipse_at_70%_60%,#2b2f4d,var(--ink))]" />}>
          <Showcase3D nodes={day.nodes} wires={day.wires} v={day.v} live={live} soc={sim.soc} progress={progress} />
        </Suspense>
        <div className="landing-shade pointer-events-none absolute inset-0" />
        <div className="landing-grain pointer-events-none absolute inset-0" />

        {/* Time rail */}
        <div className="pointer-events-none absolute top-1/2 left-4 hidden h-[46dvh] -translate-y-1/2 lg:block" aria-hidden>
          <div className="relative h-full w-px bg-(--hair)">
            <div className="absolute top-0 left-0 w-px bg-(--sun)" style={{ height: `${p * 100}%` }} />
            {['06', '09', '12', '15', '18'].map((h) => (
              <div key={h} className="mono absolute left-2 -translate-y-1/2 text-[10px] text-(--paper-dim)" style={{ top: `${((+h - 5.5) / 13.5) * 100}%` }}>
                {h}
              </div>
            ))}
          </div>
        </div>

        {/* Live readout from the engine */}
        <aside
          aria-label={T('Live readings')}
          className="landing-glass absolute top-[76px] right-3 left-3 p-3 sm:top-auto sm:bottom-3 sm:left-auto sm:w-[300px] sm:p-4 lg:right-8 lg:bottom-8"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] tracking-[.16em] text-(--paper-dim) uppercase">
                <span className="landing-pulse size-1.5 rounded-full bg-(--signal)" />
                {T('Simulated live')}
              </div>
              <div className="mono mt-1 text-[28px] leading-none font-light tabular-nums sm:text-[38px]">{clock(minute)}</div>
            </div>
            <SunArc hour={minute / 60} />
          </div>
          <div className="mt-2 mb-2 truncate text-[12px] font-semibold">{day.name}</div>
          <div className="mb-2 truncate text-[10px] tracking-[.16em] text-(--paper-dim) uppercase">
            {T('In focus')} · <span className="text-(--sun)">{T(shot.label ?? 'Whole house')}</span>
          </div>
          <div className="hidden sm:block">
            <Readout label={T('Sun')} value={`${Math.round(live.G)} W/m²`} />
            <Readout label={T('PV output')} value={watts(pv)} tone={pv > 1 ? 'var(--sun)' : undefined} />
            <Readout label={T('House load')} value={watts(live.ac.pload)} />
            <Readout label={T('Battery')} value={`${bat > 1 ? '+' : ''}${watts(bat)}`} />
            <Readout label={T(grid < -1 ? 'Grid export' : 'Grid import')} value={watts(Math.abs(grid))} tone={grid < -1 ? '#7fd49b' : undefined} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[11px] tracking-[.12em] text-(--paper-dim) uppercase">SOC</span>
            <div className="h-1.5 flex-1 bg-(--hair)">
              <div className="h-full bg-(--sun) transition-[width] duration-300" style={{ width: `${sim.soc}%` }} />
            </div>
            <span className="mono text-[13px] tabular-nums">{Math.round(sim.soc)}%</span>
          </div>
        </aside>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-20 flex items-center gap-6 bg-linear-to-b from-[rgb(9_12_21/0.62)] to-transparent px-4 pt-4 pb-8 sm:px-10 lg:px-16">
        <a href={href({ page: 'landing' })} className="flex items-center gap-2.5 text-(--paper) no-underline">
          <SunMark className="size-6 text-(--sun)" />
          <span className="text-[17px] font-bold tracking-[-0.01em]">SolarSketch</span>
        </a>
        <nav aria-label={T('Main')} className="ml-auto hidden items-center gap-6 text-[13px] font-semibold md:flex">
          <a className="landing-link" href={href({ page: 'learn' })}>
            {T('Learn')}
          </a>
          <a className="landing-link" href={href({ page: 'challenges' })}>
            {T('Challenges')}
          </a>
          <a className="landing-link" href={href({ page: 'components' })}>
            {T('Component Library')}
          </a>
          <a className="landing-link" href={href({ page: 'projects' })}>
            {T('My Projects')}
          </a>
        </nav>
        <a href={href({ page: 'lab' })} className="landing-btn landing-btn-ghost ml-auto px-4 py-2 md:ml-0">
          {T('Open the lab')}
        </a>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[calc(100dvh-72px)] flex-col justify-end px-4 pb-14 sm:px-10 sm:pb-20 lg:px-16">
        <div className="max-w-[880px]">
          <div className="landing-rise mono mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[.2em] text-(--paper-dim) uppercase">
            <span className="text-(--sun)">{T('Virtual PV lab')}</span>
            <span>·</span>
            <span>{T('Made for the Philippines')}</span>
          </div>
          <h1 className="landing-rise display m-0 text-[clamp(44px,7.6vw,112px)] leading-[0.98]" style={{ animationDelay: '0.12s' }}>
            {T('Wire the sun')}
            <br />
            <em className="text-(--sun)">{T('before')}</em> {T('you climb the roof.')}
          </h1>
          <p className="landing-rise mt-7 mb-0 max-w-[560px] text-[16px] leading-relaxed text-pretty text-(--paper-dim) sm:text-[17px]" style={{ animationDelay: '0.26s' }}>
            {T('SolarSketch is a hands-on lab for solar PV installation. Build real systems from {n} component types, check every connection, and simulate a full day: in your browser, offline, no account.', { n: COMPONENT_TYPES })}
          </p>
          <div className="landing-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '0.4s' }}>
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => void newFromTemplate(SHOWCASE_TEMPLATE)}>
              {T('Open this system in the lab')} <span className="arrow">→</span>
            </button>
            <a href={href({ page: 'learn' })} className="landing-btn landing-btn-ghost">
              {T('Start the first lesson')}
            </a>
          </div>
        </div>
        <div className="mono absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-[10px] tracking-[.25em] text-(--paper-dim) uppercase sm:flex" aria-hidden>
          {T('Scroll to sunrise')}
          <span className="landing-cue block h-12 w-px bg-(--paper)" />
        </div>
      </section>

      {/* Story: one chapter per hour */}
      <div className="relative z-10">
        {CHAPTERS.map((c, i) => (
          <Chapter key={c.at} c={c} i={i} />
        ))}
      </div>

      {/* Closing: paper sheet over the scene */}
      <section data-dusk className="relative z-10 bg-(--paper) px-4 pt-24 pb-10 text-(--ink) sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[1180px]">
          <div data-reveal className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <h2 className="display m-0 text-[clamp(40px,5.6vw,80px)] leading-[1]">
              {T('From first lesson')}
              <br />
              <em className="text-(--signal)">{T('to full system.')}</em>
            </h2>
            <p className="m-0 text-[16px] leading-relaxed text-pretty opacity-75">
              {T('Five levels of lessons, practice tasks with automatic grading, and challenges that hide real faults. Made for learners, technicians and training centres.')}
            </p>
          </div>

          <div data-reveal className="mt-16 grid gap-px bg-[rgb(13_18_29/0.14)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              [`${kwp.toFixed(1)} kWp`, 'The hybrid rooftop above, ready to open and change.'],
              ['6', 'Validation stages on every wire, each with a plain-language fix.'],
              ['0', 'Accounts needed. Your projects stay in this browser, on this device.'],
              ['EN · FIL', 'English and Filipino interface. Works offline once loaded.'],
            ].map(([k, d]) => (
              <div key={k} className="bg-(--paper) p-6">
                <div className="display text-[40px] leading-none">{k}</div>
                <p className="mt-3 mb-0 text-[14px] leading-relaxed opacity-70">{T(d)}</p>
              </div>
            ))}
          </div>

          <div data-reveal className="mt-20 flex flex-col items-start justify-between gap-8 border-t border-[rgb(13_18_29/0.18)] pt-10 md:flex-row md:items-center">
            <div className="display text-[clamp(26px,3.4vw,42px)] leading-tight">{T('The roof can wait. The sheet is ready.')}</div>
            <div className="flex flex-wrap gap-3">
              <a href={href({ page: 'lab' })} className="landing-btn bg-(--ink) text-(--paper) hover:bg-[#232b3d]">
                {T('Open the Virtual Lab')} <span className="arrow">→</span>
              </a>
              <a href={href({ page: 'learn' })} className="landing-btn border-[rgb(13_18_29/0.25)] text-(--ink) hover:bg-[rgb(13_18_29/0.06)]">
                {T('Browse lessons')}
              </a>
            </div>
          </div>

          <Footer>
            {T('SolarSketch is an educational simulation. A passing result does not certify an installation as safe, PEC-compliant or professionally approved.')}
          </Footer>
        </div>
      </section>
    </div>
  )
}

function Footer({ children }: { children: ReactNode }) {
  const T = useT()
  return (
    <footer className="mt-20 flex flex-col gap-4 border-t border-[rgb(13_18_29/0.18)] pt-6 text-[12px] opacity-70 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <SunMark className="size-4 text-(--signal)" />
        <span className="font-bold">SolarSketch</span>
        <span className="max-w-[640px] text-pretty">· {children}</span>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <span className="font-semibold">{T('Built by {name}', { name: AUTHOR })}</span>
        <a className="text-inherit" href={href({ page: 'privacy' })}>
          {T('Privacy Policy')}
        </a>
        <a className="text-inherit" href={href({ page: 'terms' })}>
          {T('Terms of Service')}
        </a>
      </div>
    </footer>
  )
}
