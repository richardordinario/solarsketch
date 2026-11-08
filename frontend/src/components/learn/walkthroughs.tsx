/**
 * Animated walkthroughs: the offline stand-in for "short instructional videos" (PRD Module 1).
 * Each is a sequence of SVG frames with a caption per step, played with play/pause/step controls.
 * Under prefers-reduced-motion every step is shown statically instead. Captions are lesson text,
 * so they stay English; the step order is general good practice, and each manufacturer’s manual
 * and the licensed installer’s procedure take precedence.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { btnOutline, btnPrimary } from '@/components/app/styles'
import { Button } from '@/components/ui/button'
import type { WalkthroughId } from '@/content/lessons'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

import { C } from './svg-colors'
import { Battery, Block, Flow, Line, Module, Svg, T } from './svg'

interface Walkthrough {
  title: string
  steps: string[]
  /** Draws the frame for a step; `still` turns off the flow animation. */
  frame: (step: number, still: boolean) => ReactNode
}

const show = (on: boolean) => ({ opacity: on ? 1 : 0, transition: 'opacity .5s' })

// ---------------------------------------------------------------------------

const safeIsolation: Walkthrough = {
  title: 'Safe isolation before work',
  steps: [
    'Identify the circuit you will work on and every source that can feed it: PV, battery, grid and generator.',
    'Switch off the loads, then open the isolator for the circuit.',
    'Lock the isolator off and attach a tag with your name, so nobody can switch it back on.',
    'Prove your voltage tester on a known live source or a proving unit.',
    'Test the isolated conductors: confirm 0 V between every pair of conductors and to earth.',
    'Prove the tester again on the known source. Only now is the circuit treated as dead. Remember: PV modules stay live in daylight up to the isolator.',
  ],
  frame: (s, still) => (
    <Svg viewBox="0 0 640 230" label="Safe isolation sequence">
      <Battery x={30} y={70} label="Source" w={84} h={50} />
      <Line pts={[[46, 64], [46, 40], [230, 40]]} color={C.pos} width={3} />
      <Line pts={[[98, 64], [98, 56], [130, 56], [130, 150], [520, 150], [520, 112]]} color={C.neg} width={3} />
      {/* isolator */}
      <circle cx={234} cy={40} r={4} style={{ fill: C.fg }} />
      <circle cx={286} cy={40} r={4} style={{ fill: C.fg }} />
      <line x1={234} y1={40} x2={s >= 1 ? 280 : 286} y2={s >= 1 ? 14 : 40} strokeWidth={3} style={{ stroke: C.fg, transition: 'all .5s' }} />
      <T x={260} y={64} size={10} color={C.muted}>
        isolator
      </T>
      <Line pts={[[290, 40], [520, 40], [520, 88]]} color={s >= 1 ? C.subtle : C.pos} width={3} />
      {s < 1 && !still && <Flow pts={[[46, 64], [46, 40], [520, 40], [520, 88]]} />}
      <Block x={480} y={88} w={80} h={24} label="Circuit" />
      {/* lock and tag */}
      <g style={show(s >= 2)}>
        <rect x={250} y={2} width={22} height={18} style={{ fill: C.primary }} />
        <path d="M254 2 v-6 a7 7 0 0 1 14 0 v6" fill="none" strokeWidth={3} style={{ stroke: C.primary }} />
        <rect x={290} y={0} width={70} height={22} strokeWidth={1} style={{ fill: C.card, stroke: C.primary }} />
        <T x={325} y={11} size={10} weight={700} color={C.primary}>
          DO NOT OPERATE
        </T>
      </g>
      {/* tester */}
      <g style={show(s >= 3)}>
        <rect x={s === 4 ? 420 : 170} y={170} width={64} height={46} strokeWidth={1.5} style={{ fill: C.node, stroke: C.fg, transition: 'x .6s' }} />
        <T x={s === 4 ? 452 : 202} y={186} size={9} color={C.muted} style={{ transition: 'x .6s' }}>
          tester
        </T>
        <T x={s === 4 ? 452 : 202} y={203} size={13} weight={700} style={{ transition: 'x .6s' }}>
          {s === 4 ? '0 V' : '230 V'}
        </T>
      </g>
      <g style={show(s === 3 || s === 5)}>
        <Block x={40} y={170} w={100} h={40} label="Known source" sub="or proving unit" />
        <T x={202} y={224} size={10} color={C.muted}>
          tester works ✓
        </T>
      </g>
      <g style={show(s === 4)}>
        <T x={560} y={196} size={10} anchor="start" color={C.muted}>
          dead ✓
        </T>
      </g>
      <T x={600} y={64} anchor="end" size={11} weight={700} color={s >= 1 ? C.muted : C.pos}>
        {s >= 1 ? 'isolated' : 'live'}
      </T>
    </Svg>
  ),
}

const seriesBuild: Walkthrough = {
  title: 'Building a series string',
  steps: [
    'One SLP-400M module: its open-circuit voltage is 49.5 V.',
    'Join the first module’s PV− to the second module’s PV+. The string now reads 99.0 V; the current is still 10.4 A.',
    'Add a third module the same way: 148.5 V.',
    'Compare with the controller’s 150 V limit. 148.5 V is under it at STC, but Voc rises on cool mornings: at 15 °C it is about 152 V, over the limit (SolarSketch flags this as RAT-012). Two modules (99 V) is the right choice for this controller.',
    'Before connecting the string, measure its Voc and polarity with the isolator open. Then connect PV+ to PV+ and PV− to PV−.',
  ],
  frame: (s) => {
    const n = s === 0 ? 1 : s === 1 ? 2 : s >= 2 && s <= 3 ? 3 : 2
    const voc = (n * 49.5).toFixed(1)
    const pct = Math.min(1, (n * 49.5) / 150)
    return (
      <Svg viewBox="0 0 640 230" label="Series string build-up">
        {[0, 1, 2].map((i) => (
          <g key={i} style={show(i < n)}>
            <Module x={40 + i * 110} y={40} w={70} h={96} />
            <T x={75 + i * 110} y={150} size={10} color={C.muted}>
              49.5 V
            </T>
            {i > 0 && <Line pts={[[110 + (i - 1) * 110, 120], [150 + (i - 1) * 110, 120]]} color={C.neg} width={3} />}
          </g>
        ))}
        {/* voltage meter */}
        <rect x={400} y={60} width={200} height={20} strokeWidth={1.5} style={{ fill: C.field, stroke: C.fg }} />
        <rect x={400} y={60} width={200 * pct} height={20} style={{ fill: n * 49.5 > 0.95 * 150 ? C.primary : C.dc, transition: 'width .6s' }} />
        <line x1={600} y1={52} x2={600} y2={88} strokeWidth={2} style={{ stroke: C.critical }} />
        <T x={600} y={100} size={10} color={C.critical}>
          150 V limit
        </T>
        <T x={500} y={40} weight={700} size={16}>
          {`Voc ${voc} V`}
        </T>
        <T x={500} y={124} size={11} color={C.muted}>
          {s === 3 ? 'little margin for cool mornings' : s >= 4 ? 'string ready to connect' : 'voltages add in series'}
        </T>
        <g style={show(s >= 4)}>
          <Block x={420} y={150} w={110} h={44} label="Controller" sub="PV+ / PV−" />
          <Line pts={[[75, 40], [75, 26], [380, 26], [380, 162], [420, 162]]} color={C.pos} width={2.5} />
          <Line pts={[[185, 136], [185, 200], [380, 200], [380, 182], [420, 182]]} color={C.neg} width={2.5} />
        </g>
      </Svg>
    )
  },
}

const batteryFirst: Walkthrough = {
  title: 'Energising an off-grid system in order',
  steps: [
    'Start with every isolator and breaker open and the PV array isolated.',
    'Connect the battery to the charge controller through its fuse or breaker, then close it. The controller detects the 24 V system from the battery.',
    'Connect the inverter DC input through the DC breaker, with the inverter switched off. Some inverters need a pre-charge step; follow the manual.',
    'Check the PV string’s polarity and Voc with a meter, then close the PV isolator. Charging starts.',
    'Switch the inverter on, then close the board’s circuits one at a time.',
    'To shut down, reverse the order: loads, inverter, PV isolator, and the battery last. Most controllers must never have PV connected without a battery.',
  ],
  frame: (s, still) => {
    const batOn = s >= 1 && s <= 4
    const invOn = s >= 2 && s <= 4
    const pvOn = s >= 3 && s <= 4
    const acOn = s === 4
    return (
      <Svg viewBox="0 0 640 220" label="Off-grid energising order">
        <Block x={20} y={30} w={80} h={44} label="PV" dim={!pvOn} />
        <Block x={150} y={30} w={90} h={44} label="Controller" dim={!batOn} />
        <Block x={150} y={140} w={90} h={44} label="Battery" />
        <Block x={330} y={140} w={90} h={44} label="Inverter" dim={!invOn} />
        <Block x={500} y={140} w={110} h={44} label="Board + loads" dim={!acOn} />
        <Line pts={[[100, 52], [150, 52]]} color={pvOn ? C.pos : C.subtle} width={3} />
        <Line pts={[[195, 74], [195, 140]]} color={batOn ? C.pos : C.subtle} width={3} />
        <Line pts={[[240, 162], [330, 162]]} color={invOn ? C.pos : C.subtle} width={3} />
        <Line pts={[[420, 162], [500, 162]]} color={acOn ? C.l : C.subtle} width={3} />
        {!still && pvOn && <Flow pts={[[100, 52], [150, 52]]} />}
        {!still && pvOn && <Flow pts={[[195, 74], [195, 140]]} />}
        {!still && invOn && <Flow pts={[[240, 162], [330, 162]]} />}
        {!still && acOn && <Flow pts={[[420, 162], [500, 162]]} />}
        {[
          [125, 40, 3],
          [205, 100, 1],
          [285, 150, 2],
          [460, 150, 4],
        ].map(([x, y, k]) => (
          <g key={k}>
            <circle cx={x} cy={y} r={11} strokeWidth={2} style={{ fill: s === k ? C.primary : C.card, stroke: s >= k && s <= 4 ? C.primary : C.muted, transition: 'fill .4s' }} />
            <T x={x} y={y + 0.5} size={11} weight={700} color={s === k ? 'white' : C.fg}>
              {k}
            </T>
          </g>
        ))}
        <T x={320} y={210} size={11} color={C.muted}>
          {s === 0 ? 'everything open' : s === 5 ? 'shutdown: 4 → 3 → 2 → 1' : `step ${s} closes point ${s}`}
        </T>
      </Svg>
    )
  },
}

const COMMISSIONING_ROWS = [
  ['Visual inspection', 'matches the design'],
  ['Protective earth continuity', '0.1 Ω'],
  ['Insulation resistance', '> 1 MΩ'],
  ['String polarity and Voc', '99.2 V (≈ 99 V)'],
  ['Functional tests', 'RCD trips · loads run'],
  ['Records and handover', 'signed off'],
] as const

const commissioning: Walkthrough = {
  title: 'Testing and commissioning sequence',
  steps: [
    'Inspect the installation against the approved design before anything is energised: equipment, ratings, mounting, labels and terminations.',
    'With the system isolated, check the continuity of every protective earth and bonding conductor.',
    'Measure insulation resistance of the DC and AC wiring with an insulation tester, following the instrument and equipment instructions.',
    'Check the polarity of every string and measure its open-circuit voltage. Compare with the expected value at the measured temperature; a string about one module low points to a missing or faulty module.',
    'Energise in the safe order and test functions: inverter start, charging, loads, RCD test button, and for grid-tied systems disconnection when the grid is removed.',
    'Record every result, label the system, and hand over the documentation to the owner. A qualified, licensed person signs the records.',
  ],
  frame: (s) => (
    <Svg viewBox="0 0 640 250" label="Commissioning checklist">
      <rect x={20} y={14} width={600} height={226} strokeWidth={1.5} style={{ fill: C.card, stroke: C.fg }} />
      {COMMISSIONING_ROWS.map(([name, reading], i) => {
        const y = 32 + i * 35
        const done = i < s
        const cur = i === s
        return (
          <g key={name}>
            {cur && <rect x={22} y={y - 14} width={596} height={30} style={{ fill: C.soft, opacity: 0.5 }} />}
            <rect x={36} y={y - 8} width={16} height={16} strokeWidth={1.5} style={{ fill: done ? C.pe : C.card, stroke: done ? C.pe : C.muted, transition: 'fill .4s' }} />
            {done && (
              <T x={44} y={y + 1} size={12} weight={700} color="white">
                ✓
              </T>
            )}
            <T x={66} y={y} anchor="start" weight={cur ? 700 : 400} color={done || cur ? C.fg : C.muted}>
              {`${i + 1}. ${name}`}
            </T>
            <T x={600} y={y} anchor="end" size={11} weight={700} color={done || cur ? C.fg : C.subtle} style={show(done || cur)}>
              {reading}
            </T>
          </g>
        )
      })}
    </Svg>
  ),
}

const WALKTHROUGHS: Record<WalkthroughId, Walkthrough> = {
  'safe-isolation': safeIsolation,
  'series-build': seriesBuild,
  'battery-first': batteryFirst,
  commissioning,
}

// ---------------------------------------------------------------------------
// Player

const STEP_MS = 4500

const motionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
function useReducedMotion() {
  return useSyncExternalStore(
    (fn) => {
      motionQuery?.addEventListener('change', fn)
      return () => motionQuery?.removeEventListener('change', fn)
    },
    () => !!motionQuery?.matches,
    () => false,
  )
}

export function WalkthroughPlayer({ id }: { id: WalkthroughId }) {
  const w = WALKTHROUGHS[id]
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const last = w.steps.length - 1

  useEffect(() => {
    if (!playing || reduced) return
    const timer = window.setTimeout(() => {
      if (step >= last) setPlaying(false)
      else setStep(step + 1)
    }, STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, step, last])

  if (reduced)
    return (
      <div>
        <div className="border-b border-rule px-4 py-2 text-[13px] font-strong">{w.title}</div>
        <ol className="m-0 list-none p-0">
          {w.steps.map((caption, i) => (
            <li key={i} className="border-b border-rule last:border-b-0">
              <div className="px-4 pt-3">{w.frame(i, true)}</div>
              <p className="m-0 px-4 py-2 text-[13px] text-pretty">
                <span className="font-strong">{t('Step {a} of {b}', { a: i + 1, b: w.steps.length })}.</span> {caption}
              </p>
            </li>
          ))}
        </ol>
      </div>
    )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2">
        <span className="min-w-0 flex-1 text-[13px] font-strong">{w.title}</span>
        <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">{t('Step {a} of {b}', { a: step + 1, b: w.steps.length })}</span>
      </div>
      <div className="px-4 pt-3">{w.frame(step, false)}</div>
      <p aria-live="polite" className="m-0 min-h-[4.5em] px-4 py-2 text-[14px] text-pretty">
        {w.steps[step]}
      </p>
      <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-2">
        <Button
          className={btnPrimary}
          onClick={() => {
            if (!playing && step >= last) setStep(0)
            setPlaying(!playing)
          }}
        >
          {playing ? t('Pause') : step >= last ? t('Replay') : t('Play')}
        </Button>
        <Button
          variant="outline"
          className={btnOutline}
          disabled={step === 0}
          onClick={() => {
            setPlaying(false)
            setStep(step - 1)
          }}
        >
          {t('Previous step')}
        </Button>
        <Button
          variant="outline"
          className={btnOutline}
          disabled={step >= last}
          onClick={() => {
            setPlaying(false)
            setStep(step + 1)
          }}
        >
          {t('Next step')}
        </Button>
        <div className="ml-auto flex gap-1" aria-hidden>
          {w.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => {
                setPlaying(false)
                setStep(i)
              }}
              className={cn('h-2 w-5 border-0 p-0', i === step ? 'bg-primary' : i < step ? 'bg-secondary' : 'bg-muted')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
