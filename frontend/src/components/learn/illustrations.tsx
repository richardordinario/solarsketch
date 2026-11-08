/**
 * Static lesson illustrations (PRD Module 1 "Illustrations"): inline SVG drawn with theme colours.
 * Each takes the figure caption as its accessible label. Values shown are the SolarSketch catalog
 * defaults or round educational numbers, never real-product data.
 */
import { C } from './svg-colors'
import { Battery, Block, Earth, Line, Module, PeLine, Pole, Sun, Svg, T } from './svg'
import { useArrow } from './use-arrow'

export function PvHierarchy({ label }: { label: string }) {
  const [defs, arrow] = useArrow(C.muted)
  return (
    <Svg viewBox="0 0 640 220" label={label}>
      {defs}
      {/* Cell */}
      <rect x={30} y={70} width={44} height={44} strokeWidth={1.5} style={{ fill: C.dc, opacity: 0.45, stroke: C.fg }} />
      <T x={52} y={140} weight={700}>
        Cell
      </T>
      <T x={52} y={157} size={10} color={C.muted}>
        ≈ 0.5–0.6 V
      </T>
      <Line pts={[[90, 92], [128, 92]]} color={C.muted} marker={arrow} />
      {/* Module */}
      <Module x={140} y={50} w={64} h={88} />
      <T x={172} y={160} weight={700}>
        Module
      </T>
      <T x={172} y={177} size={10} color={C.muted}>
        cells in series
      </T>
      <Line pts={[[220, 92], [258, 92]]} color={C.muted} marker={arrow} />
      {/* String */}
      {[0, 1, 2].map((i) => (
        <Module key={i} x={270 + i * 46} y={62} w={38} h={60} cols={2} rows={4} />
      ))}
      <Line pts={[[308, 92], [316, 92]]} color={C.neg} width={2} />
      <Line pts={[[354, 92], [362, 92]]} color={C.neg} width={2} />
      <T x={337} y={160} weight={700}>
        String
      </T>
      <T x={337} y={177} size={10} color={C.muted}>
        modules in series: V adds
      </T>
      <Line pts={[[420, 92], [458, 92]]} color={C.muted} marker={arrow} />
      {/* Array */}
      {[0, 1].map((r) =>
        [0, 1, 2].map((i) => <Module key={`${r}${i}`} x={470 + i * 46} y={30 + r * 70} w={38} h={60} cols={2} rows={4} />),
      )}
      <T x={537} y={182} weight={700}>
        Array
      </T>
      <T x={537} y={199} size={10} color={C.muted}>
        strings in parallel: I adds
      </T>
    </Svg>
  )
}

export function CircuitBasics({ label }: { label: string }) {
  const [defs, arrow] = useArrow(C.pos)
  return (
    <Svg viewBox="0 0 640 230" label={label}>
      {defs}
      <Battery x={60} y={92} label="24 V" sub="source" w={84} h={50} />
      <Line pts={[[76, 86], [76, 40], [520, 40], [520, 90]]} color={C.pos} width={3} />
      <Line pts={[[128, 86], [128, 70], [170, 70], [170, 190], [520, 190], [520, 140]]} color={C.neg} width={3} />
      <Line pts={[[260, 40], [320, 40]]} color={C.pos} width={3} marker={arrow} />
      <T x={290} y={24} weight={700} color={C.pos}>
        I = 2.5 A →
      </T>
      <T x={290} y={208} size={11} color={C.muted}>
        ← current returns on the negative conductor
      </T>
      <circle cx={520} cy={115} r={24} strokeWidth={2} style={{ fill: C.node, stroke: C.fg }} />
      <Line pts={[[503, 98], [537, 132]]} color={C.fg} width={2} />
      <Line pts={[[537, 98], [503, 132]]} color={C.fg} width={2} />
      <T x={575} y={108} anchor="start" weight={700}>
        Load
      </T>
      <T x={575} y={124} anchor="start" size={10} color={C.muted}>
        60 W lamp
      </T>
      <rect x={220} y={86} width={220} height={58} strokeWidth={1} style={{ fill: C.field, stroke: C.rule }} />
      <T x={330} y={104} weight={700}>
        P = V × I = 24 × 2.5 = 60 W
      </T>
      <T x={330} y={126} size={11} color={C.muted}>
        5 hours: E = 60 W × 5 h = 300 Wh
      </T>
    </Svg>
  )
}

export function AcDc({ label }: { label: string }) {
  const sine = Array.from({ length: 121 }, (_, i) => {
    const x = 350 + i * 2.0
    return [x, 110 - 60 * Math.sin((i / 120) * 4 * Math.PI)] as [number, number]
  })
  return (
    <Svg viewBox="0 0 640 210" label={label}>
      {[30, 350].map((x0) => (
        <g key={x0}>
          <Line pts={[[x0, 30], [x0, 190]]} color={C.muted} width={1} />
          <Line pts={[[x0, 110], [x0 + 270, 110]]} color={C.muted} width={1} />
          <T x={x0 + 270} y={124} anchor="end" size={10} color={C.muted}>
            time
          </T>
        </g>
      ))}
      <Line pts={[[30, 60], [300, 60]]} color={C.pos} width={3} />
      <T x={40} y={45} anchor="start" weight={700}>
        DC: one direction, steady voltage
      </T>
      <T x={40} y={140} anchor="start" size={11} color={C.muted}>
        PV modules and batteries
      </T>
      <Line pts={sine} color={C.l} width={3} />
      <T x={360} y={24} anchor="start" weight={700}>
        AC: 230 V, 60 Hz
      </T>
      <T x={360} y={196} anchor="start" size={11} color={C.muted}>
        two cycles shown, 1/30 of a second
      </T>
    </Svg>
  )
}

export function ShadingBypass({ label }: { label: string }) {
  const [defs, arrow] = useArrow(C.pos)
  return (
    <Svg viewBox="0 0 640 250" label={label}>
      {defs}
      <Module x={120} y={30} w={210} h={150} cols={3} rows={6} shade={1} />
      <T x={225} y={18} size={11} color={C.muted}>
        middle cell group shaded
      </T>
      {[0, 1, 2].map((g) => {
        const x0 = 120 + g * 70
        const cx = x0 + 35
        const on = g === 1
        const col = on ? C.pos : C.muted
        return (
          <g key={g}>
            <Line pts={[[x0 + 4, 180], [x0 + 4, 211], [cx - 8, 211]]} color={col} width={on ? 2.5 : 1.5} />
            <Line pts={[[cx + 8, 211], [x0 + 66, 211], [x0 + 66, 180]]} color={col} width={on ? 2.5 : 1.5} marker={on ? arrow : undefined} />
            <polygon points={`${cx - 8},203 ${cx - 8},219 ${cx + 8},211`} strokeWidth={1.5} style={{ fill: on ? C.pos : C.card, stroke: C.fg }} />
            <Line pts={[[cx + 8, 202], [cx + 8, 220]]} color={C.fg} width={2} />
            <T x={cx} y={236} size={10} color={on ? C.pos : C.muted} weight={on ? 700 : 400}>
              {on ? 'diode conducts' : 'diode off'}
            </T>
          </g>
        )
      })}
      <T x={360} y={70} anchor="start" weight={700}>
        Bypass diodes
      </T>
      <T x={360} y={92} anchor="start" size={11} color={C.muted}>
        Current flows around the shaded
      </T>
      <T x={360} y={108} anchor="start" size={11} color={C.muted}>
        group, so the module loses about a
      </T>
      <T x={360} y={124} anchor="start" size={11} color={C.muted}>
        third of its voltage instead of
      </T>
      <T x={360} y={140} anchor="start" size={11} color={C.muted}>
        most of its output.
      </T>
    </Svg>
  )
}

export function SeriesParallel({ label }: { label: string }) {
  return (
    <Svg viewBox="0 0 640 260" label={label}>
      {/* Series */}
      <T x={160} y={18} weight={700}>
        Series (2S)
      </T>
      <Module x={60} y={40} w={60} h={84} />
      <Module x={200} y={40} w={60} h={84} />
      <Pole x={90} y={140} sign="+" />
      <Pole x={110} y={140} sign="−" />
      <Pole x={220} y={140} sign="+" />
      <Pole x={240} y={140} sign="−" />
      <Line pts={[[110, 146], [110, 170], [220, 170], [220, 146]]} color={C.neg} width={3} />
      <T x={165} y={184} size={10} color={C.muted}>
        PV− to PV+
      </T>
      <Line pts={[[90, 146], [90, 205]]} color={C.pos} width={3} />
      <Line pts={[[240, 146], [240, 205]]} color={C.neg} width={3} />
      <T x={165} y={222} weight={700}>
        Voc 99.0 V · Isc 10.4 A
      </T>
      <T x={165} y={240} size={10} color={C.muted}>
        voltages add, current stays the same
      </T>
      <Line pts={[[320, 20], [320, 245]]} color={C.rule} width={1} />
      {/* Parallel */}
      <T x={480} y={18} weight={700}>
        Parallel (2P)
      </T>
      <Module x={380} y={40} w={60} h={84} />
      <Module x={520} y={40} w={60} h={84} />
      <Pole x={400} y={140} sign="+" />
      <Pole x={420} y={140} sign="−" />
      <Pole x={540} y={140} sign="+" />
      <Pole x={560} y={140} sign="−" />
      <Line pts={[[400, 146], [400, 175], [540, 175], [540, 146]]} color={C.pos} width={3} />
      <Line pts={[[420, 146], [420, 190], [560, 190], [560, 146]]} color={C.neg} width={3} />
      <Line pts={[[470, 175], [470, 205]]} color={C.pos} width={3} />
      <Line pts={[[490, 190], [490, 205]]} color={C.neg} width={3} />
      <T x={480} y={222} weight={700}>
        Voc 49.5 V · Isc 20.8 A
      </T>
      <T x={480} y={240} size={10} color={C.muted}>
        currents add, voltage stays the same
      </T>
    </Svg>
  )
}

export function BatteryBank({ label }: { label: string }) {
  const bat = (x: number, y: number) => <Battery x={x} y={y} label="12.8 V" sub="100 Ah" w={76} h={46} />
  const string = (x: number) => (
    <g>
      {bat(x, 60)}
      {bat(x, 150)}
      {/* series link: top B− to bottom B+ */}
      <Line pts={[[x + 60, 54], [x + 60, 46], [x + 90, 46], [x + 90, 128], [x + 16, 128], [x + 16, 144]]} color={C.neg} width={2.5} />
      {/* top B+ to the positive bus, bottom B− to the negative bus */}
      <Line pts={[[x + 16, 54], [x + 16, 30]]} color={C.pos} width={3} />
      <Line pts={[[x + 60, 144], [x + 60, 140], [x + 110, 140], [x + 110, 215]]} color={C.neg} width={3} />
    </g>
  )
  return (
    <Svg viewBox="0 0 640 260" label={label}>
      <T x={178} y={14} weight={700}>
        String 1
      </T>
      <T x={438} y={14} weight={700}>
        String 2
      </T>
      {string(140)}
      {string(400)}
      <Line pts={[[90, 30], [416, 30]]} color={C.pos} width={3} />
      <Line pts={[[250, 215], [560, 215]]} color={C.neg} width={3} />
      <T x={84} y={30} anchor="end" size={11} weight={700} color={C.pos}>
        Bank +
      </T>
      <T x={566} y={215} anchor="start" size={11} weight={700}>
        Bank −
      </T>
      <T x={320} y={246} size={11} color={C.muted}>
        2S2P: 25.6 V · 200 Ah · 5.12 kWh · bank + from one end, bank − from the other
      </T>
    </Svg>
  )
}

export function SystemTypes({ label }: { label: string }) {
  const [defs, arrow] = useArrow(C.muted)
  const row = (y: number, title: string, blocks: [string, string?][]) => (
    <g>
      <T x={14} y={y + 20} anchor="start" weight={700} size={13}>
        {title}
      </T>
      {blocks.map(([lb, sub], i) => (
        <g key={lb}>
          <Block x={110 + i * 106} y={y} w={86} h={40} label={lb} sub={sub} />
          {i < blocks.length - 1 && <Line pts={[[196 + i * 106, y + 20], [214 + i * 106, y + 20]]} color={C.muted} marker={arrow} />}
        </g>
      ))}
    </g>
  )
  return (
    <Svg viewBox="0 0 640 320" label={label}>
      {defs}
      {row(16, 'Off-grid', [['PV', 'DC'], ['Controller'], ['Battery'], ['Inverter', 'DC → AC'], ['Loads', '230 V']])}
      {row(106, 'Grid-tied', [['PV', 'DC'], ['Grid-tied', 'inverter'], ['Board', 'loads'], ['Net meter', 'both ways'], ['Grid']])}
      <T x={375} y={162} size={10} color={C.muted}>
        surplus exported by day, imported at night · inverter stops in a brownout
      </T>
      {row(196, 'Hybrid', [['PV', 'DC'], ['Hybrid', 'inverter']])}
      <Block x={340} y={196} w={86} h={40} label="Grid" sub="(+ generator)" />
      <Line pts={[[340, 216], [304, 216]]} color={C.muted} marker={arrow} />
      <Block x={216} y={262} w={86} h={36} label="Battery" />
      <Line pts={[[259, 238], [259, 260]]} color={C.muted} marker={arrow} />
      <Block x={340} y={262} w={86} h={36} label="Backup loads" />
      <Line pts={[[290, 236], [290, 250], [320, 250], [320, 280], [338, 280]]} color={C.muted} marker={arrow} />
      <T x={446} y={270} anchor="start" size={10} color={C.muted}>
        backup loads keep running
      </T>
      <T x={446} y={285} anchor="start" size={10} color={C.muted}>
        from the battery in a brownout
      </T>
    </Svg>
  )
}

export function ProtectionMap({ label }: { label: string }) {
  const prot = (x: number, y: number, lb: string, sub: string) => (
    <g>
      <rect x={x} y={y} width={64} height={30} strokeWidth={2} style={{ fill: C.card, stroke: C.primary }} />
      <T x={x + 32} y={y + 10} size={10} weight={700}>
        {lb}
      </T>
      <T x={x + 32} y={y + 22} size={9} color={C.muted}>
        {sub}
      </T>
    </g>
  )
  return (
    <Svg viewBox="0 0 640 240" label={label}>
      <Line pts={[[70, 60], [346, 60]]} color={C.pos} width={2.5} />
      <Block x={10} y={40} w={60} h={40} label="PV" />
      {prot(90, 45, 'Isolator', 'DC, + fuses')}
      <Block x={174} y={40} w={70} h={40} label="Controller" />
      {prot(262, 45, 'Fuse / CB', 'DC')}
      <Block x={346} y={40} w={80} h={40} label="Battery" />
      <Line pts={[[386, 80], [386, 120], [120, 120], [120, 170], [234, 170]]} color={C.pos} width={2.5} />
      <Line pts={[[312, 170], [500, 170]]} color={C.l} width={2.5} />
      {prot(150, 155, 'DC breaker', 'near battery')}
      <Block x={234} y={150} w={78} h={40} label="Inverter" />
      {prot(332, 155, 'Isolator', 'AC')}
      {prot(416, 155, 'RCD + MCB', 'board')}
      <Block x={500} y={150} w={80} h={40} label="Loads" />
      <PeLine pts={[[273, 190], [273, 210], [610, 210], [610, 214]]} />
      <PeLine pts={[[448, 185], [448, 210]]} />
      <Earth x={610} y={216} />
      <T x={440} y={228} size={10} color={C.muted}>
        protective earth
      </T>
      <T x={450} y={55} anchor="start" size={11} color={C.muted}>
        Red outline = protection
      </T>
      <T x={450} y={71} anchor="start" size={11} color={C.muted}>
        or isolation device
      </T>
    </Svg>
  )
}

export function RcdPrinciple({ label }: { label: string }) {
  const [defs, arrow] = useArrow(C.critical)
  return (
    <Svg viewBox="0 0 640 250" label={label}>
      {defs}
      <ellipse cx={170} cy={110} rx={26} ry={62} strokeWidth={8} style={{ fill: 'none', stroke: C.subtle }} />
      <T x={170} y={190} size={10} color={C.muted}>
        sensing coil
      </T>
      <Line pts={[[20, 80], [470, 80]]} color={C.l} width={3} />
      <Line pts={[[20, 140], [470, 140]]} color={C.n} width={3} />
      <T x={24} y={66} anchor="start" size={11} weight={700} color={C.l}>
        L out: 1.00 A
      </T>
      <T x={24} y={156} anchor="start" size={11} weight={700} color={C.n}>
        N back: 0.97 A
      </T>
      <rect x={465} y={70} width={120} height={80} strokeWidth={1.5} style={{ fill: C.node, stroke: C.fg }} />
      <T x={525} y={102} weight={700}>
        Appliance
      </T>
      <T x={525} y={120} size={10} color={C.muted}>
        damaged insulation
      </T>
      <Line pts={[[525, 150], [525, 215]]} color={C.critical} width={2.5} dash="6 4" marker={arrow} />
      <Earth x={525} y={220} />
      <T x={540} y={190} anchor="start" size={11} weight={700} color={C.critical}>
        30 mA to earth
      </T>
      <rect x={250} y={180} width={230} height={52} strokeWidth={1} style={{ fill: C.field, stroke: C.rule }} />
      <T x={365} y={198} weight={700}>
        I(L) − I(N) = 30 mA → trip
      </T>
      <T x={365} y={218} size={10} color={C.muted}>
        normally equal; any difference leaks to earth
      </T>
    </Svg>
  )
}

export function VoltageDrop({ label }: { label: string }) {
  const zig = (x: number, y: number) => {
    const pts: [number, number][] = [[x, y]]
    for (let i = 0; i < 8; i++) pts.push([x + 6 + i * 12, y + (i % 2 ? 8 : -8)])
    pts.push([x + 102, y])
    return pts
  }
  return (
    <Svg viewBox="0 0 640 220" label={label}>
      <Battery x={30} y={84} label="24.0 V" sub="source" w={84} h={50} />
      <Line pts={[[46, 78], [46, 50], [250, 50]]} color={C.pos} width={3} />
      <Line pts={zig(250, 50)} color={C.pos} width={2} />
      <Line pts={[[352, 50], [540, 50], [540, 88]]} color={C.pos} width={3} />
      <Line pts={[[98, 78], [98, 66], [140, 66], [140, 170], [250, 170]]} color={C.neg} width={3} />
      <Line pts={zig(250, 170)} color={C.neg} width={2} />
      <Line pts={[[352, 170], [540, 170], [540, 132]]} color={C.neg} width={3} />
      <T x={301} y={28} size={11} color={C.muted}>
        cable resistance: −0.26 V
      </T>
      <T x={301} y={196} size={11} color={C.muted}>
        return conductor: −0.26 V
      </T>
      <rect x={500} y={88} width={80} height={44} strokeWidth={1.5} style={{ fill: C.node, stroke: C.fg }} />
      <T x={540} y={104} weight={700}>
        23.5 V
      </T>
      <T x={540} y={121} size={10} color={C.muted}>
        at the load
      </T>
      <rect x={160} y={88} width={300} height={44} strokeWidth={1} style={{ fill: C.field, stroke: C.rule }} />
      <T x={310} y={104} weight={700}>
        Drop = 2 × L × I × ρ ÷ A
      </T>
      <T x={310} y={121} size={10} color={C.muted}>
        ρ = 0.0175 Ω·mm²/m for copper (SolarSketch value)
      </T>
    </Svg>
  )
}

export function Earthing({ label }: { label: string }) {
  const devices: [number, string][] = [
    [30, 'PV frames'],
    [150, 'Controller'],
    [270, 'Inverter'],
    [390, 'Battery rack'],
    [510, 'Board'],
  ]
  return (
    <Svg viewBox="0 0 640 260" label={label}>
      {devices.map(([x, lb]) => (
        <g key={lb}>
          <Block x={x} y={20} w={100} h={40} label={lb} />
          <PeLine pts={[[x + 50, 60], [x + 50, 120]]} />
        </g>
      ))}
      <rect x={60} y={120} width={520} height={14} strokeWidth={1.5} style={{ fill: C.card, stroke: C.pe }} />
      <T x={320} y={127} size={10} weight={700}>
        main earth bar
      </T>
      <PeLine pts={[[320, 134], [320, 190]]} />
      <rect x={0} y={190} width={640} height={70} style={{ fill: C.field }} />
      <Line pts={[[0, 190], [640, 190]]} color={C.muted} width={1} />
      <rect x={315} y={190} width={10} height={60} style={{ fill: C.subtle }} />
      <T x={340} y={220} anchor="start" size={11} color={C.muted}>
        earth electrode (rod) driven into the soil
      </T>
      <T x={20} y={168} anchor="start" size={10} color={C.muted}>
        green/yellow = protective earth (PE) and bonding conductors
      </T>
    </Svg>
  )
}

export function SingleLine({ label }: { label: string }) {
  const tick = (x: number, y: number) => <Line pts={[[x - 5, y + 6], [x + 5, y - 6]]} color={C.fg} width={1.5} />
  const breaker = (x: number, y: number, lb: string) => (
    <g>
      <rect x={x - 10} y={y - 10} width={20} height={20} strokeWidth={2} style={{ fill: C.card, stroke: C.fg }} />
      <Line pts={[[x - 6, y + 6], [x + 6, y - 6]]} color={C.fg} width={2} />
      <T x={x} y={y - 18} size={10} color={C.muted}>
        {lb}
      </T>
    </g>
  )
  const y = 110
  return (
    <Svg viewBox="0 0 640 200" label={label}>
      <rect x={16} y={y - 26} width={60} height={52} strokeWidth={1.5} style={{ fill: C.field, stroke: C.fg }} />
      <Line pts={[[16, y + 26], [76, y - 26]]} color={C.fg} width={1} />
      <T x={46} y={y + 44} size={10} weight={700}>
        PV 2 × 400 W
      </T>
      <T x={46} y={y + 58} size={10} color={C.muted}>
        2S, Voc 99 V
      </T>
      <Line pts={[[76, y], [600, y]]} color={C.fg} width={2} />
      {tick(100, y)}
      {tick(106, y)}
      <T x={103} y={y + 22} size={9} color={C.muted}>
        2 × 6 mm²
      </T>
      {breaker(140, y, 'DC iso')}
      <Block x={170} y={y - 22} w={70} h={44} label="MPPT" sub="150 V / 60 A" />
      {breaker(270, y, '125 A')}
      <Block x={296} y={y - 22} w={70} h={44} label="BAT" sub="25.6 V 200 Ah" />
      {breaker(396, y, '63 A DC')}
      <Block x={422} y={y - 22} w={70} h={44} label="INV" sub="3 kW 230 V" />
      {breaker(520, y, '30 mA RCD')}
      <rect x={548} y={y - 22} width={70} height={44} strokeWidth={1.5} style={{ fill: C.node, stroke: C.fg }} />
      <T x={583} y={y - 6} size={11} weight={700}>
        Board
      </T>
      <T x={583} y={y + 10} size={9} color={C.muted}>
        2 circuits
      </T>
      <T x={320} y={186} size={10} color={C.muted}>
        one line = one circuit · slashes = number of conductors · each device labelled with its rating
      </T>
    </Svg>
  )
}

export function MultiMppt({ label }: { label: string }) {
  return (
    <Svg viewBox="0 0 640 240" label={label}>
      <Sun x={40} y={36} />
      <T x={70} y={36} anchor="start" size={11} color={C.muted}>
        morning sun (east)
      </T>
      <Sun x={600} y={36} />
      <T x={570} y={36} anchor="end" size={11} color={C.muted}>
        afternoon sun (west)
      </T>
      <Module x={40} y={80} w={46} h={66} cols={2} rows={4} />
      <Module x={96} y={80} w={46} h={66} cols={2} rows={4} />
      <T x={91} y={164} size={11} weight={700}>
        East string
      </T>
      <Module x={498} y={80} w={46} h={66} cols={2} rows={4} />
      <Module x={554} y={80} w={46} h={66} cols={2} rows={4} />
      <T x={549} y={164} size={11} weight={700}>
        West string
      </T>
      <rect x={210} y={80} width={220} height={130} strokeWidth={1.5} style={{ fill: C.node, stroke: C.fg }} />
      <T x={320} y={98} weight={700}>
        Inverter or controllers
      </T>
      <Block x={226} y={116} w={86} h={40} label="MPPT 1" sub="tracks east" />
      <Block x={328} y={116} w={86} h={40} label="MPPT 2" sub="tracks west" />
      <T x={320} y={186} size={10} color={C.muted}>
        each tracker finds its own best voltage
      </T>
      <Line pts={[[142, 113], [180, 113], [180, 136], [226, 136]]} color={C.pos} width={2.5} />
      <Line pts={[[498, 113], [460, 113], [460, 136], [414, 136]]} color={C.pos} width={2.5} />
    </Svg>
  )
}

export function GeneratorAts({ label }: { label: string }) {
  const [defs, arrow] = useArrow(C.muted)
  return (
    <Svg viewBox="0 0 640 250" label={label}>
      {defs}
      <Block x={20} y={30} w={90} h={40} label="Grid" sub="net meter" />
      <Block x={20} y={150} w={90} h={40} label="Generator" sub="auto-start" />
      <Line pts={[[110, 50], [180, 50], [180, 90]]} color={C.l} width={2.5} />
      <Line pts={[[110, 170], [180, 170], [180, 130]]} color={C.l} width={2.5} />
      <rect x={150} y={90} width={70} height={40} strokeWidth={2} style={{ fill: C.card, stroke: C.primary }} />
      <T x={185} y={104} size={11} weight={700}>
        ATS
      </T>
      <T x={185} y={119} size={9} color={C.muted}>
        one at a time
      </T>
      <Line pts={[[220, 110], [290, 110]]} color={C.l} width={2.5} marker={arrow} />
      <T x={256} y={98} size={9} color={C.muted}>
        AC input
      </T>
      <Block x={290} y={80} w={110} h={60} label="Hybrid" sub="inverter" />
      <Block x={300} y={10} w={90} h={36} label="PV" />
      <Line pts={[[345, 46], [345, 80]]} color={C.pos} width={2.5} />
      <Block x={300} y={180} w={90} h={36} label="Battery" />
      <Line pts={[[345, 140], [345, 180]]} color={C.pos} width={2.5} />
      <Line pts={[[400, 110], [470, 110]]} color={C.l} width={2.5} marker={arrow} />
      <T x={436} y={98} size={9} color={C.muted}>
        load output
      </T>
      <Block x={470} y={90} w={100} h={40} label="Backup loads" />
      <T x={470} y={150} anchor="start" size={10} weight={700} color={C.critical}>
        ✕ never connect a generator
      </T>
      <T x={470} y={164} anchor="start" size={10} weight={700} color={C.critical}>
        or the grid to this side
      </T>
    </Svg>
  )
}

export function EnergyDay({ label }: { label: string }) {
  const X = (h: number) => 50 + h * 23
  const Y = (kw: number) => 190 - kw * 70
  const solar = (h: number) => (h < 6 || h > 18 ? 0 : 2 * Math.sin(((h - 6) / 12) * Math.PI))
  const load = (h: number) => 0.35 + 0.25 * Math.exp(-((h - 7) ** 2) / 2) + 1.1 * Math.exp(-((h - 20) ** 2) / 4) + 0.2 * Math.exp(-((h - 13) ** 2) / 8)
  const hours = Array.from({ length: 97 }, (_, i) => i / 4)
  const solarPts = hours.map((h) => [X(h), Y(solar(h))] as [number, number])
  const loadPts = hours.map((h) => [X(h), Y(load(h))] as [number, number])
  const overlap = hours.map((h) => [X(h), Y(Math.min(solar(h), load(h)))] as [number, number])
  const area = (pts: [number, number][]) => `M${X(0)},${Y(0)} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(' ') + ` L${X(24)},${Y(0)} Z`
  return (
    <Svg viewBox="0 0 640 230" label={label}>
      <path d={area(solarPts)} style={{ fill: C.soft, opacity: 0.6 }} />
      <path d={area(overlap)} style={{ fill: C.primary, opacity: 0.35 }} />
      <Line pts={solarPts} color={C.primary} width={2.5} />
      <Line pts={loadPts} color={C.fg} width={2.5} dash="6 4" />
      <Line pts={[[X(0), Y(0)], [X(24), Y(0)]]} color={C.muted} width={1} />
      {[0, 6, 12, 18, 24].map((h) => (
        <T key={h} x={X(h)} y={Y(0) + 14} size={10} color={C.muted}>
          {`${String(h).padStart(2, '0')}:00`}
        </T>
      ))}
      <T x={X(12)} y={Y(2.05) - 10} size={11} weight={700} color={C.primary}>
        solar generation
      </T>
      <T x={X(20.5)} y={Y(1.45) - 8} size={11} weight={700}>
        household demand
      </T>
      <T x={X(12)} y={Y(0.25)} size={10} weight={700}>
        self-consumed
      </T>
      <T x={X(12)} y={Y(1.25)} size={10} color={C.fg}>
        surplus: store or export
      </T>
      <T x={X(24)} y={Y(0.12)} anchor="end" size={10} color={C.muted}>
        evening: battery or grid
      </T>
    </Svg>
  )
}
