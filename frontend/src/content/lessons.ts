/**
 * Guided lessons (PRD Module 1, Levels 1–5). Educational simplifications are stated in the text;
 * nothing here is installation guidance, and no lesson or simulation result certifies a real
 * installation or Philippine Electrical Code (PEC) compliance.
 *
 * Lesson text stays English (see CLAUDE.md i18n). Media blocks reference illustrations, widgets and
 * walkthroughs by id; their React renderers live in components/learn/.
 */
import { DESIGN_MIN_TEMP, PERFORMANCE_FACTOR } from '@/engine/pv-model'
import type { ComponentType } from '@/engine/types'

/** Static SVG diagrams (components/learn/illustrations.tsx). */
export type IllustrationId =
  | 'pv-hierarchy'
  | 'circuit-basics'
  | 'ac-dc'
  | 'shading-bypass'
  | 'series-parallel'
  | 'battery-bank'
  | 'system-types'
  | 'protection-map'
  | 'rcd-principle'
  | 'voltage-drop'
  | 'earthing'
  | 'single-line'
  | 'multi-mppt'
  | 'generator-ats'
  | 'energy-day'

/** Interactive calculators (components/learn/widgets.tsx). */
export type WidgetId = 'pv-output' | 'power-energy' | 'string-calc' | 'battery-calc' | 'voltage-drop' | 'load-sizing'

/** Animated step-by-step walkthroughs (components/learn/walkthroughs.tsx). */
export type WalkthroughId = 'safe-isolation' | 'series-build' | 'battery-first' | 'commissioning'

export type LessonMedia =
  | { kind: 'illustration'; id: IllustrationId; caption: string }
  | { kind: 'interactive'; id: WidgetId; caption: string }
  /** Catalog components with a thumbnail and a link to the Components page. */
  | { kind: 'hardware'; types: ComponentType[]; caption?: string }
  | { kind: 'walkthrough'; id: WalkthroughId; caption?: string }
  /**
   * A local instructional video under public/videos/ (never a third-party embed, so the app stays
   * offline-capable and private). `captions` is a WebVTT file under public/videos/. None ship yet.
   */
  | { kind: 'video'; src: string; title: string; caption: string; captions?: string; poster?: string }

export interface LessonSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
  /** Optional worked example, shown as a formula block. */
  example?: string
  /** Illustrations, interactive diagrams, hardware references, walkthroughs or videos, shown after the text. */
  media?: LessonMedia[]
}

export interface CheckQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
}

export interface Lesson {
  id: string
  level: 1 | 2 | 3 | 4 | 5
  title: string
  summary: string
  minutes: number
  sections: LessonSection[]
  check: CheckQuestion[]
  /** Practice task ids from content/tasks.ts. */
  practice: string[]
}

/** Fraction of knowledge-check answers needed to complete a lesson. */
export const PASS_MARK = 2 / 3

export const LEVEL_TITLES: Record<Lesson['level'], string> = {
  1: 'Level 1 — Solar Fundamentals',
  2: 'Level 2 — Solar Components',
  3: 'Level 3 — Solar System Configurations',
  4: 'Level 4 — Solar Installation Principles',
  5: 'Level 5 — Advanced Solar Systems',
}

/** Shown on lessons about real work. */
const PRO_NOTE =
  'SolarSketch is a learning tool. Real installation, testing and commissioning work must be designed, done or supervised by licensed electrical practitioners (a Registered or Professional Electrical Engineer and licensed electricians, as the work requires), under an electrical permit, following the Philippine Electrical Code (PEC) and the manufacturers’ instructions.'

// ---------------------------------------------------------------------------
// Level 1 — Solar Fundamentals

const level1: Lesson[] = [
  {
    id: 'solar-basics',
    level: 1,
    title: 'Solar energy and how a PV module works',
    summary: 'Sunlight as an energy source, photovoltaic cells, and reading a module datasheet.',
    minutes: 9,
    sections: [
      {
        heading: 'Solar energy in the Philippines',
        paragraphs: [
          'Sunlight arriving at the ground carries up to about 1,000 watts per square metre (W/m²) at midday on a clear day. This is called irradiance. Clouds, haze and the sun’s angle reduce it, so it changes through the day and the year.',
          'Designers often summarise a site’s sunlight as peak sun hours: the daily solar energy expressed as hours at 1,000 W/m². Much of the Philippines averages roughly 4 to 5 peak sun hours per day, with lower values in the rainy season. Use measured data for your exact location for any real estimate.',
        ],
      },
      {
        heading: 'From sunlight to DC',
        paragraphs: [
          'A photovoltaic (PV) cell is a thin slice of semiconductor, usually silicon. When light strikes it, it frees electrons, and the cell’s internal electric field pushes them in one direction. The result is direct current (DC): current that flows one way only.',
          'One silicon cell produces only about half a volt, so a module (panel) connects dozens of cells in series inside a frame. Modules are joined into strings, and strings into an array. The module has two output terminals: PV+ and PV−.',
        ],
        media: [
          { kind: 'illustration', id: 'pv-hierarchy', caption: 'Cell, module, string and array. Each step up joins the units before it, adding voltage (series) or current (parallel).' },
          { kind: 'hardware', types: ['pv'] },
        ],
      },
      {
        heading: 'Reading a module datasheet',
        paragraphs: ['Every module is rated at Standard Test Conditions (STC): 1000 W/m² of sunlight at a cell temperature of 25 °C. The key values are:'],
        bullets: [
          'Rated power (Pmax), in watts: the output at STC. The SLP-400M in the library is a 400 W module.',
          'Open-circuit voltage (Voc): the voltage with nothing connected. It is the highest voltage the module produces, and the value used for voltage-limit checks.',
          'Max-power voltage (Vmp) and current (Imp): the operating point where the module delivers its rated power.',
          'Short-circuit current (Isc): the highest current the module can deliver. It is used to size cables and protection.',
        ],
      },
      {
        heading: 'Real output is lower than the rating',
        paragraphs: [
          `Real modules rarely deliver their full rating: sunlight is weaker than 1000 W/m² for most of the day, and heat, dust and wiring all cause losses. SolarSketch uses a simplified model, P_PV = P_STC × (G ÷ 1000) × f, where G is irradiance and f = ${PERFORMANCE_FACTOR.toFixed(2)} lumps soiling, wiring, mismatch and ageing losses together. It then corrects for cell temperature (using a fixed lowland Philippine day), the module’s tilt and direction, and bifacial gain. It is an educational approximation, not a yield forecast.`,
        ],
        example: `400 W module at G = 600 W/m²:  400 × (600 ÷ 1000) × ${PERFORMANCE_FACTOR.toFixed(2)} = ${Math.round(400 * 0.6 * PERFORMANCE_FACTOR)} W, before the temperature and orientation corrections`,
        media: [{ kind: 'interactive', id: 'pv-output', caption: 'Change the irradiance, the number of modules and the cell temperature to see the simplified SolarSketch estimate.' }],
      },
    ],
    check: [
      {
        question: 'What kind of electricity does a PV module produce?',
        options: ['Direct current (DC)', 'Alternating current (AC)', 'Either, depending on the time of day'],
        answer: 0,
        explanation: 'PV cells produce DC. An inverter is needed to supply AC appliances.',
      },
      {
        question: 'Which datasheet value is used to check a module against a controller’s maximum input voltage?',
        options: ['Max-power voltage (Vmp)', 'Open-circuit voltage (Voc)', 'Rated power (Pmax)'],
        answer: 1,
        explanation: 'Voc is the highest voltage the module produces, so voltage limits are checked against it.',
      },
      {
        question: 'What are Standard Test Conditions (STC)?',
        options: ['1000 W/m² irradiance at 25 °C cell temperature', 'Average sunlight at noon in Manila', '800 W/m² at 45 °C ambient temperature'],
        answer: 0,
        explanation: 'STC is a laboratory reference: 1000 W/m² and a 25 °C cell. Real conditions are usually less favourable.',
      },
      {
        question: 'A 400 W module receives 500 W/m². Before any losses, about how much power can it produce?',
        options: ['400 W', '200 W', '100 W'],
        answer: 1,
        explanation: 'Output scales with irradiance: 400 × (500 ÷ 1000) = 200 W. Heat, dust and wiring losses then reduce it further.',
      },
    ],
    practice: ['practice-pv-terminals'],
  },
  {
    id: 'electricity-basics',
    level: 1,
    title: 'Voltage, current, power and energy',
    summary: 'The four quantities every solar calculation uses, and how they relate.',
    minutes: 8,
    sections: [
      {
        heading: 'Voltage and current',
        paragraphs: [
          'Voltage (V, in volts) is the electrical “pressure” that pushes charge around a circuit. Current (I, in amperes or amps, A) is the rate at which charge flows. A circuit needs a complete loop for current to flow: out of the source, through the load and back.',
          'Resistance (R, in ohms, Ω) opposes current. Ohm’s law links the three: V = I × R. A thin or long cable has more resistance than a thick or short one, which matters for cable sizing later.',
        ],
        media: [{ kind: 'illustration', id: 'circuit-basics', caption: 'A simple DC circuit: the source sets the voltage, the load draws a current, and the current returns to the source.' }],
      },
      {
        heading: 'Power',
        paragraphs: [
          'Power (P, in watts, W) is the rate of using or producing energy. For DC, power equals voltage times current: P = V × I. The same power can be delivered at a high voltage with low current, or a low voltage with high current. Higher current needs thicker cables.',
        ],
        example: '1,200 W at 24 V:  I = 1,200 ÷ 24 = 50 A.     1,200 W at 230 V:  I = 1,200 ÷ 230 ≈ 5.2 A',
      },
      {
        heading: 'Energy',
        paragraphs: [
          'Energy (E) is power over time, measured in watt-hours (Wh) or kilowatt-hours (kWh, 1 kWh = 1,000 Wh). Your electricity bill counts kWh. Batteries are rated by the energy they store, and solar systems are sized by the energy they must deliver each day.',
          'Do not mix up kW and kWh: a 1 kW kettle running for 15 minutes uses 0.25 kWh.',
        ],
        example: '100 W lamp × 5 h = 500 Wh = 0.5 kWh',
        media: [{ kind: 'interactive', id: 'power-energy', caption: 'Set a voltage, a power and the hours of use to see the current and the energy.' }],
      },
    ],
    check: [
      {
        question: 'A 24 V circuit supplies a 480 W load. What is the current?',
        options: ['10 A', '20 A', '11,520 A'],
        answer: 1,
        explanation: 'I = P ÷ V = 480 ÷ 24 = 20 A.',
      },
      {
        question: 'A 100 W lamp runs for 5 hours. How much energy does it use?',
        options: ['20 W', '500 Wh (0.5 kWh)', '105 Wh'],
        answer: 1,
        explanation: 'Energy = power × time = 100 W × 5 h = 500 Wh.',
      },
      {
        question: 'Which quantity is a battery’s stored energy measured in?',
        options: ['Watts (W)', 'Watt-hours (Wh or kWh)', 'Volts (V)'],
        answer: 1,
        explanation: 'Energy is measured in Wh or kWh. Watts measure power, a rate.',
      },
      {
        question: 'The same 1,200 W is delivered at 24 V and at 230 V. Which needs the thicker cable?',
        options: ['The 230 V circuit', 'The 24 V circuit', 'Both need the same cable'],
        answer: 1,
        explanation: 'At 24 V the current is about 50 A, against about 5 A at 230 V. Higher current needs a thicker conductor.',
      },
    ],
    practice: [],
  },
  {
    id: 'dc-polarity',
    level: 1,
    title: 'DC polarity and AC versus DC',
    summary: 'Why positive must meet positive, and why DC and AC circuits are kept apart.',
    minutes: 7,
    sections: [
      {
        heading: 'Polarity',
        paragraphs: [
          'Every DC source has a positive (+) and a negative (−) terminal. Current leaves the positive terminal, flows through the circuit, and returns to the negative terminal. Connecting positive to positive and negative to negative keeps polarity correct.',
          'Reversed polarity can damage equipment. Many charge controllers, inverters and batteries are not protected against it, and a reversed battery connection can cause very high currents.',
        ],
        bullets: ['In SolarSketch, DC+ terminals and wires are red and DC− are dark grey or black.', 'These colours are visual conventions only. Follow the conductor identification rules that apply to a real installation.'],
      },
      {
        heading: 'Series is not reversed polarity',
        paragraphs: ['Joining one module’s PV− to the next module’s PV+ is a series connection, not a polarity fault. It is how modules are chained to add their voltages. The validator recognises this case.'],
      },
      {
        heading: 'AC and DC',
        paragraphs: [
          'Household appliances in the Philippines use alternating current (AC) at 230 V, 60 Hz. AC completes 60 cycles per second, reversing direction twice in each cycle. SolarSketch draws AC circuits with line (L), neutral (N) and protective earth (PE) conductors.',
          'In many Philippine homes the 230 V supply arrives on two conductors that are both live relative to earth, rather than one line and one neutral. SolarSketch uses the simpler L/N model; the real arrangement depends on the distribution utility’s service and the PEC.',
          'DC circuits (PV, controller, battery) and AC circuits (inverter output, distribution board, loads) must never be connected directly. The only path between them is through the inverter. Line must never be connected to neutral, because that is a short circuit.',
        ],
        media: [{ kind: 'illustration', id: 'ac-dc', caption: 'DC stays at one polarity. AC at 60 Hz reverses direction 120 times a second (60 full cycles).' }],
      },
    ],
    check: [
      {
        question: 'A module’s PV+ is wired to the controller’s PV− input. What is this?',
        options: ['A series connection', 'Reversed polarity', 'A parallel connection'],
        answer: 1,
        explanation: 'Positive must meet positive at the controller input. PV− to the next module’s PV+ is series; to the controller’s PV− it would be reversed.',
      },
      {
        question: 'How does DC from the battery reach an AC appliance?',
        options: ['Through a direct cable from battery to the appliance', 'Through the inverter', 'Through the charge controller'],
        answer: 1,
        explanation: 'The inverter converts DC to AC. DC and AC circuits are never connected directly.',
      },
      {
        question: 'What is the standard household supply in the Philippines?',
        options: ['120 V, 60 Hz', '230 V, 50 Hz', '230 V, 60 Hz'],
        answer: 2,
        explanation: 'The Philippines uses 230 V at 60 Hz.',
      },
    ],
    practice: ['practice-polarity'],
  },
  {
    id: 'electrical-safety',
    level: 1,
    title: 'Basic electrical safety for solar work',
    summary: 'Why PV and battery circuits are hazardous, and the habits that keep people safe.',
    minutes: 9,
    sections: [
      {
        heading: 'How electricity injures',
        paragraphs: [
          'Current through the body, not voltage alone, causes injury. A few tens of milliamps across the chest can disturb the heart’s rhythm. The current depends on the voltage and on body and contact resistance, which drop sharply with wet skin, sweat and damp ground.',
          'Electricity also injures through burns, through arc flash (an explosive flash of heat and light from a fault), and through falls caused by a shock while working at height.',
        ],
      },
      {
        heading: 'Hazards particular to solar systems',
        bullets: [
          'PV modules are live whenever light reaches them. There is no switch on a module, so a string can be at a dangerous voltage on a cloudy day. Opening an isolator makes the downstream side safe, not the modules and the cables up to the isolator.',
          'DC arcs are harder to break than AC arcs because DC never passes through zero. Never pull a DC connector apart under load; switch off with a DC-rated isolator or breaker first.',
          'Batteries can deliver thousands of amps into a short circuit. A dropped spanner across battery terminals can weld, burn and explode. Use insulated tools and remove rings and watches.',
          'Roofs add fall hazards and heat stress. Work at height needs proper access equipment and fall protection.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Safe working habits',
        paragraphs: [
          'Professionals follow a safe-isolation procedure before touching any conductor: isolate, lock and tag the isolation point, then prove the circuit dead with a tester that is itself proven to work. Treat every conductor as live until it is proven dead.',
          PRO_NOTE,
        ],
        bullets: [
          'Wear suitable personal protective equipment (insulating gloves, safety glasses, non-conductive footwear) for the task.',
          'Never work alone on live or high-energy equipment.',
          'Follow each manufacturer’s installation manual; it overrides any general rule of thumb.',
        ],
        media: [{ kind: 'walkthrough', id: 'safe-isolation' }],
      },
    ],
    check: [
      {
        question: 'An array’s DC isolator is switched off. Which part of the circuit is still live in daylight?',
        options: ['Nothing; the whole system is now safe', 'The modules and the cables from the modules to the isolator', 'Only the AC distribution board'],
        answer: 1,
        explanation: 'Modules generate whenever light reaches them. The isolator only makes the circuit after it safe.',
      },
      {
        question: 'Why should a DC connector never be pulled apart under load?',
        options: ['DC arcs do not self-extinguish easily because DC never crosses zero', 'It resets the charge controller', 'DC connectors are designed to be disconnected under load'],
        answer: 0,
        explanation: 'An AC arc tends to go out at each zero crossing; a DC arc can be sustained and cause burns or fire.',
      },
      {
        question: 'Before touching a conductor after isolating it, what must you do?',
        options: ['Wait five minutes', 'Prove it dead with a tester that you have checked on a known live source', 'Touch it briefly with the back of your hand'],
        answer: 1,
        explanation: 'Prove the tester, test the circuit, then prove the tester again. Never use your body as a tester.',
      },
      {
        question: 'Who may carry out a real solar installation in the Philippines?',
        options: ['Anyone who has completed SolarSketch lessons', 'Licensed electrical practitioners, under an electrical permit and following the PEC', 'Only the equipment supplier'],
        answer: 1,
        explanation: 'SolarSketch is educational only. Real work needs licensed practitioners and the applicable permits.',
      },
    ],
    practice: [],
  },
]

// ---------------------------------------------------------------------------
// Level 2 — Solar Components

const level2: Lesson[] = [
  {
    id: 'solar-panels',
    level: 2,
    title: 'Solar panels in practice',
    summary: 'Module types, heat, shading and bypass diodes, and where to place modules.',
    minutes: 9,
    sections: [
      {
        heading: 'Module types',
        bullets: [
          'Monocrystalline silicon: the most common module type today, with efficiencies around 20% or more.',
          'Polycrystalline silicon: slightly lower efficiency, now less common.',
          'Thin-film: lighter or flexible, lower efficiency, so it needs more area for the same power.',
          'Bifacial modules also collect light reflected onto their rear side; the extra gain depends on mounting height and the surface below.',
        ],
        paragraphs: [],
        media: [{ kind: 'hardware', types: ['pv', 'pvpoly', 'pvbif', 'pvflex'] }],
      },
      {
        heading: 'Heat reduces output',
        paragraphs: [
          'Module output falls as cell temperature rises. A typical crystalline module loses about 0.3–0.4% of its power for every degree Celsius above 25 °C, and cells on a sunny Philippine roof often run 20–30 °C above the air temperature. Voltage also falls with heat and rises in cool conditions, which is why the coldest expected morning sets the highest string voltage.',
          'Datasheets give these temperature coefficients and a Nominal Operating Cell Temperature (NOCT or NMOT) rating, which is closer to field conditions than STC.',
        ],
        example: '400 W module, cells at 55 °C, coefficient −0.35 %/°C:  400 × (1 − 0.0035 × 30) ≈ 358 W',
      },
      {
        heading: 'Shading and bypass diodes',
        paragraphs: [
          'Cells in a module are in series, so a shaded cell restricts the current of its whole group. Modules contain bypass diodes (usually three) that let current flow around a heavily shaded group, so one shaded group costs only part of the module’s output instead of all of it.',
          'Even small shadows from wires, antennas or a neighbour’s tree can cut output noticeably. A shaded cell can also overheat into a hot spot. Choose an unshaded location and keep modules clean.',
        ],
        media: [{ kind: 'illustration', id: 'shading-bypass', caption: 'A shaded cell group is bypassed: the module keeps producing from its other groups at a lower voltage.' }],
      },
      {
        heading: 'Orientation and tilt',
        paragraphs: [
          'The Philippines lies roughly between 5° and 20° north of the equator, so modules generally face south with a low tilt. A tilt of around 10–15° is common; some tilt also helps rain wash dust off. East- or west-facing roofs still work but produce less around noon and more in the morning or afternoon.',
          'Mounting must resist typhoon wind loads. Structural design, roof attachment and waterproofing are specialist work.',
        ],
      },
    ],
    check: [
      {
        question: 'What happens to a module’s power as its cells get hotter?',
        options: ['It increases', 'It decreases', 'It stays exactly at the STC rating'],
        answer: 1,
        explanation: 'Crystalline modules lose roughly 0.3–0.4% per °C above 25 °C.',
      },
      {
        question: 'What does a bypass diode do?',
        options: ['Stops reverse current from the battery at night', 'Lets current flow around a shaded group of cells', 'Raises the module voltage in the morning'],
        answer: 1,
        explanation: 'Bypass diodes route current around a shaded or failed cell group, limiting the loss and the hot-spot risk.',
      },
      {
        question: 'When does a string reach its highest open-circuit voltage?',
        options: ['On the hottest afternoon', 'On the coldest bright morning', 'At midnight'],
        answer: 1,
        explanation: 'Voltage rises as temperature falls, so cold bright mornings give the highest Voc.',
      },
      {
        question: 'In the Philippines, which direction do fixed modules generally face?',
        options: ['North', 'South', 'Straight up, always flat'],
        answer: 1,
        explanation: 'North of the equator the sun is mostly in the southern sky, so modules face roughly south with a low tilt.',
      },
    ],
    practice: [],
  },
  {
    id: 'controllers-batteries',
    level: 2,
    title: 'Charge controllers and batteries',
    summary: 'MPPT versus PWM, matching system voltage, battery chemistries and state of charge.',
    minutes: 10,
    sections: [
      {
        heading: 'What a charge controller does',
        paragraphs: ['A charge controller sits between the PV array and the battery. It charges the battery safely and stops charging when the battery is full, so the battery is not overcharged.'],
        bullets: [
          'PWM controllers connect the array almost directly to the battery, so the array works near battery voltage. They are simple and inexpensive, but they waste energy when the module voltage is much higher than the battery voltage, and they accept only low PV input voltages.',
          'MPPT (maximum power point tracking) controllers convert a higher PV voltage down to battery voltage and keep the array at its maximum-power point. They are more efficient and accept longer series strings.',
        ],
        media: [{ kind: 'hardware', types: ['mppt', 'pwm'] }],
      },
      {
        heading: 'Matching system voltage',
        paragraphs: [
          'Off-grid systems are built around a nominal DC system voltage, commonly 12, 24 or 48 V. The battery bank, the controller’s battery setting and the inverter’s DC input must all match. Larger systems use higher voltages to keep currents, and therefore cable sizes, manageable.',
        ],
      },
      {
        heading: 'Battery chemistries',
        bullets: [
          'Lead-acid (flooded, AGM, gel): 2 V per cell, so six cells make a 12 V battery. Inexpensive, but heavy, and its life shortens quickly if it is regularly discharged deeply; designers often plan to use only about half its capacity.',
          'Lithium iron phosphate (LiFePO4 or LFP): 3.2 V per cell, so 4 cells give 12.8 V, 8 cells 25.6 V and 16 cells 51.2 V. Longer cycle life and a larger usable capacity, and it needs a battery management system (BMS).',
        ],
        paragraphs: ['Never mix chemistries, and always charge with the settings the battery manufacturer specifies.'],
        media: [{ kind: 'hardware', types: ['bat', 'batfla', 'batagm', 'batgel'] }],
      },
      {
        heading: 'Capacity and state of charge',
        paragraphs: [
          'Capacity is given in amp-hours (Ah). Multiply by the nominal voltage to get energy. State of charge (SOC) is how full the battery is, from 0 to 100%. Depth of discharge (DoD) is how much has been used.',
          'Batteries should not be fully discharged. In SolarSketch the inverter shuts down at 10% SOC to protect the battery and restarts at 20%. Different chemistries have different safe limits; always follow the manufacturer’s datasheet.',
        ],
        example: '25.6 V × 200 Ah = 5,120 Wh = 5.12 kWh',
      },
    ],
    check: [
      {
        question: 'Which controller can accept a 99 V PV string and charge a 24 V battery efficiently?',
        options: ['PWM', 'MPPT', 'Neither'],
        answer: 1,
        explanation: 'MPPT controllers convert a higher PV voltage down to battery voltage.',
      },
      {
        question: 'How much energy does a 25.6 V, 100 Ah battery store?',
        options: ['2.56 kWh', '125.6 Wh', '25.6 kWh'],
        answer: 0,
        explanation: '25.6 V × 100 Ah = 2,560 Wh = 2.56 kWh.',
      },
      {
        question: 'The inverter has a 24 V DC input. Which battery bank matches it?',
        options: ['12.8 V LiFePO4', '25.6 V LiFePO4', '51.2 V LiFePO4'],
        answer: 1,
        explanation: 'A 25.6 V LiFePO4 bank (8 cells) is the nominal 24 V system voltage.',
      },
      {
        question: 'How many lead-acid cells make a nominal 12 V battery?',
        options: ['4', '6', '8'],
        answer: 1,
        explanation: 'Lead-acid cells are 2 V nominal, so six cells give 12 V.',
      },
    ],
    practice: ['practice-battery'],
  },
  {
    id: 'inverters-protection',
    level: 2,
    title: 'Inverters and DC protection',
    summary: 'Turning DC into AC, and protecting the PV and battery circuits with fuses, breakers and isolators.',
    minutes: 10,
    sections: [
      {
        heading: 'The inverter',
        paragraphs: [
          'An off-grid inverter converts battery DC into 230 V, 60 Hz AC for appliances. Choose a pure sine wave inverter for general household loads. Its continuous rating (for example 3,000 W) is the most it can supply for long periods. Motors in refrigerators, pumps and aircon units draw a short surge, often several times their running power, when they start; the inverter’s surge rating must cover it.',
          'Conversion is not free: the inverter loses a few percent as heat and draws standby power even with no load. If the loads exceed its rating it switches off (overload), and if the battery runs too low it shuts down (low-voltage disconnect).',
        ],
        example: '3,000 W ÷ (24 V × 0.93) ≈ 134 A drawn from the battery at full load',
        media: [{ kind: 'hardware', types: ['inv'] }],
      },
      {
        heading: 'DC protection devices',
        paragraphs: ['A battery can deliver a very large current into a fault, enough to melt cables and start a fire. Every DC circuit therefore needs devices rated for DC at the circuit’s voltage:'],
        bullets: [
          'Fuses (for example gPV fuses for PV strings, and high-capacity fuses near batteries) melt to interrupt an overcurrent. They must be rated for DC at the circuit voltage and able to break the battery’s fault current.',
          'DC circuit breakers interrupt overcurrents and can be reset. Some DC breakers are polarity-sensitive and must be wired the way their markings show.',
          'DC isolators (switch-disconnectors) let you switch a circuit off for maintenance. An isolator gives no overcurrent protection on its own.',
          'String fuses are generally needed when three or more PV strings are connected in parallel, because the other strings can push a reverse current into a faulted string. Check the module’s maximum series fuse rating.',
        ],
        media: [
          { kind: 'illustration', id: 'protection-map', caption: 'Where protection sits in an off-grid system: PV isolation, battery overcurrent protection close to the battery, and AC protection at the board.' },
          { kind: 'hardware', types: ['dcb', 'fuse', 'iso', 'dspd', 'cbx'] },
        ],
      },
      {
        heading: 'Protecting the battery circuit',
        paragraphs: [
          'A DC breaker or fuse goes in the positive conductor between the battery and the inverter, as close to the battery as practical, so that the cable it protects is as short as possible.',
          'Conductors must be sized for the current they can carry. Thin cable on a high-current circuit overheats. SolarSketch flags conductors whose ampacity is below the expected current.',
        ],
        media: [{ kind: 'walkthrough', id: 'battery-first' }],
      },
    ],
    check: [
      {
        question: 'Where does the DC breaker go in a battery–inverter circuit?',
        options: ['In the positive conductor between the battery and the inverter, close to the battery', 'On the AC output only', 'Between the PV module and the controller only'],
        answer: 0,
        explanation: 'The battery can deliver a very high fault current, so the battery–inverter positive conductor is protected close to the battery.',
      },
      {
        question: 'Connected loads total 3,400 W on a 3,000 W inverter. What happens?',
        options: ['The inverter overloads and switches off its output', 'The battery supplies the extra 400 W directly', 'Nothing; ratings are only guidelines'],
        answer: 0,
        explanation: 'Loads above the continuous rating overload the inverter, which protects itself by switching off.',
      },
      {
        question: 'What does a DC isolator provide?',
        options: ['Overcurrent protection', 'A means of switching the circuit off for safe maintenance', 'Protection against earth leakage'],
        answer: 1,
        explanation: 'An isolator disconnects a circuit. Overcurrent protection comes from fuses or breakers.',
      },
      {
        question: 'Why must an AC-only breaker not be used in a battery circuit?',
        options: ['It is too expensive', 'It may not be able to interrupt a DC arc safely', 'AC breakers only work at night'],
        answer: 1,
        explanation: 'DC arcs are harder to extinguish. Use devices rated for DC at the circuit voltage.',
      },
    ],
    practice: ['practice-protection', 'practice-inverter'],
  },
  {
    id: 'ac-protection',
    level: 2,
    title: 'AC protection devices',
    summary: 'Miniature circuit breakers, residual-current devices, surge protection and isolators on the AC side.',
    minutes: 9,
    sections: [
      {
        heading: 'Miniature circuit breakers (MCB)',
        paragraphs: [
          'An MCB protects a circuit’s cable against overload and short circuit. A thermal element trips on a sustained overload, and a magnetic element trips almost instantly on a short circuit. Each branch circuit in the distribution board has its own breaker, rated for the cable it protects, not for the appliance.',
          'The breaker rating must not exceed what the cable can safely carry. A 2.5 mm² circuit, for example, is never protected by a breaker larger than that cable’s ampacity under its installation conditions.',
        ],
      },
      {
        heading: 'Residual-current devices (RCD, RCCB, RCBO)',
        paragraphs: [
          'An RCD compares the current going out on the line conductor with the current returning on the neutral. Normally they are equal. If some current leaks to earth, for example through a damaged appliance or a person, the difference (the residual current) trips the device.',
          'RCDs rated at 30 mA are used for additional protection of people. An RCCB is a standalone RCD; an RCBO combines an RCD and an MCB in one device. An RCD does not protect against overload, and it cannot detect a shock between line and neutral alone.',
          'Press the RCD’s test button periodically to confirm it still trips.',
        ],
        media: [{ kind: 'illustration', id: 'rcd-principle', caption: 'An RCD measures the difference between line and neutral current. Leakage to earth unbalances them and trips the device.' }],
      },
      {
        heading: 'Surge protection devices (SPD)',
        paragraphs: [
          'Lightning, even nearby rather than a direct strike, and switching on the grid cause brief voltage surges. An SPD diverts the surge to earth, limiting the voltage that reaches equipment. Solar systems use AC SPDs at the distribution board and DC SPDs rated for the PV voltage near the inverter or controller. An SPD only works with a good earth connection.',
        ],
      },
      {
        heading: 'Isolators and the distribution board',
        paragraphs: [
          'AC isolators let you disconnect the inverter output or the grid supply for maintenance. The distribution board collects the incoming supply, the main isolator, RCDs, MCBs and the earth bar in one enclosure. Convenience outlets should always be fed from a protected board circuit, not straight from an inverter.',
          'In SolarSketch the AC distribution board stands for a board with a 30 mA RCD and branch breakers. Its RCD trip current is a specification you can edit.',
        ],
        media: [{ kind: 'hardware', types: ['mcb', 'rccb', 'aspd', 'acsw', 'acdb', 'outlet'] }],
      },
    ],
    check: [
      {
        question: 'What does an RCD measure?',
        options: ['The total power drawn by the circuit', 'The difference between line and neutral current', 'The voltage between line and neutral'],
        answer: 1,
        explanation: 'An RCD trips when current leaks to earth, which unbalances line and neutral.',
      },
      {
        question: 'Which RCD rating is used for additional protection of people?',
        options: ['30 mA', '300 mA', '30 A'],
        answer: 0,
        explanation: '30 mA RCDs are used for additional protection against electric shock.',
      },
      {
        question: 'What sets the rating of a branch-circuit MCB?',
        options: ['The appliance plugged in', 'The cable it protects', 'The inverter rating'],
        answer: 1,
        explanation: 'A breaker protects its cable, so its rating must not exceed the cable’s ampacity.',
      },
      {
        question: 'Where should a convenience outlet be supplied from?',
        options: ['Directly from the inverter output terminals', 'A protected circuit (L1/L2) in the distribution board', 'The battery'],
        answer: 1,
        explanation: 'Board circuits provide the breaker and RCD that protect the outlet and its users.',
      },
      {
        question: 'What does a surge protection device need to work?',
        options: ['A good connection to earth', 'A battery', 'A 30 mA RCD upstream'],
        answer: 0,
        explanation: 'An SPD diverts surge current to earth, so it relies on a sound earth connection.',
      },
    ],
    practice: ['practice-ac-protection'],
  },
  {
    id: 'cables-connectors',
    level: 2,
    title: 'Electrical cables and connectors',
    summary: 'PV cable, MC4 connectors, ampacity and voltage drop.',
    minutes: 9,
    sections: [
      {
        heading: 'Cable types',
        paragraphs: ['Every cable has a conductor (usually stranded copper) and insulation rated for a voltage and a maximum temperature.'],
        bullets: [
          'PV cable (solar cable) is double-insulated, UV- and weather-resistant, and rated for the array’s DC voltage. Ordinary building wire is not suitable for exposed outdoor runs.',
          'Building wire such as THHN/THWN is common for AC circuits in the Philippines; it is run inside conduit or raceway.',
          'Battery cables are short, flexible and large, because battery currents are high.',
        ],
      },
      {
        heading: 'MC4 connectors',
        paragraphs: [
          'PV modules come with MC4-type plug-and-socket connectors. They latch together and are weatherproof when fully mated. Only mate connectors of the same make and type, crimp them with the correct tool, and never disconnect them under load.',
          'Badly crimped or mismatched connectors are a common cause of overheating and fires in PV arrays.',
        ],
        media: [{ kind: 'hardware', types: ['mc4', 'ybr'] }],
      },
      {
        heading: 'Ampacity',
        paragraphs: [
          'Ampacity is the current a conductor can carry continuously without overheating. It depends on the cross-section (mm²), insulation rating, ambient temperature, and how cables are grouped or enclosed. Hot roofs and bundled cables reduce it; codes apply correction (derating) factors.',
          'SolarSketch uses one simplified ampacity table (for example 2.5 mm² = 24 A, 6 mm² = 41 A, 25 mm² = 101 A). Real values come from the PEC tables for the actual installation method.',
        ],
      },
      {
        heading: 'Voltage drop',
        paragraphs: [
          'Every cable has resistance, so some voltage is lost along it. The loss grows with current and length, and falls with a thicker conductor. On low-voltage DC circuits a few volts lost is a large fraction of the system voltage. Designers commonly keep the drop within a few percent; SolarSketch flags drops above 3%.',
        ],
        example: 'Drop V = 2 × length × current × 0.0175 ÷ area.  6 m round trip at 20 A on 4 mm²:  2 × 3 × 20 × 0.0175 ÷ 4 ≈ 0.53 V (2.2% of 24 V)',
        media: [
          { kind: 'illustration', id: 'voltage-drop', caption: 'Current flows out and back, so both conductors drop voltage. The load sees less than the source voltage.' },
          { kind: 'interactive', id: 'voltage-drop', caption: 'Uses the same copper resistivity and ampacity table as the SolarSketch validator.' },
        ],
      },
    ],
    check: [
      {
        question: 'Why is PV cable used for exposed array wiring?',
        options: ['It is cheaper than building wire', 'It is double-insulated and resists UV and weather', 'It does not need connectors'],
        answer: 1,
        explanation: 'PV cable is designed for outdoor DC service, with double insulation and UV resistance.',
      },
      {
        question: 'Two MC4 connectors from different manufacturers are available. What should you do?',
        options: ['Mate them; all MC4 connectors are identical', 'Use matching connectors of the same make and type', 'Tape them together'],
        answer: 1,
        explanation: 'Mismatched connectors can have poor contact and overheat.',
      },
      {
        question: 'How does doubling the cable length affect voltage drop at the same current?',
        options: ['It halves', 'It stays the same', 'It doubles'],
        answer: 2,
        explanation: 'Voltage drop is proportional to length.',
      },
      {
        question: 'Which conditions reduce a cable’s ampacity?',
        options: ['High ambient temperature and bundling with other cables', 'A shorter cable run', 'A lower system voltage'],
        answer: 0,
        explanation: 'Heat and grouping make it harder for the cable to shed heat, so codes derate it.',
      },
    ],
    practice: [],
  },
  {
    id: 'grounding-bonding',
    level: 2,
    title: 'Grounding and bonding',
    summary: 'Protective earth, equipment bonding and the earth electrode.',
    minutes: 8,
    sections: [
      {
        heading: 'Why we earth equipment',
        paragraphs: [
          'Protective earth (PE) connects exposed metal parts of equipment to the earthing system. If a live conductor touches a metal case, the fault current flows through the PE conductor and the protective device trips, instead of leaving the case live for the next person who touches it.',
          'PE does not carry current in normal operation, and it must never be connected to a current-carrying terminal. PE conductors are identified with green/yellow insulation (or green, depending on the code in use).',
        ],
        media: [{ kind: 'illustration', id: 'earthing', caption: 'Equipment PE terminals and metal frames are bonded to the main earth bar, which connects to the earth electrode.' }],
      },
      {
        heading: 'Bonding',
        paragraphs: [
          'Bonding connects metal parts together so they stay at the same potential. In solar systems, module frames and mounting rails are bonded with listed bonding clips or lugs, and inverter, controller, battery enclosure and board earth terminals all connect to the same earthing system.',
          'A good bond needs clean metal contact. Anodised aluminium frames need the bonding hardware the manufacturer specifies, because the anodised layer insulates.',
        ],
      },
      {
        heading: 'The earth electrode',
        paragraphs: [
          'The earthing system connects to the ground through an earth electrode, often a copper-bonded steel rod driven into the soil. Its resistance to earth depends on the soil and moisture. The PEC sets the requirements; if one rod is not good enough, more rods or other electrodes are added.',
          'All the earthing points in one installation should connect together. Separate, unconnected earths can sit at different voltages during a fault or a lightning surge.',
          'In SolarSketch, connect each PE terminal to a grounding rod or to the board’s PE bar (which is itself earthed). The validator flags missing earth connections (GND rules) and PV frames, controllers and battery enclosures that are not bonded (BND-001). It cannot judge real earth resistance or bonding quality.',
        ],
        media: [{ kind: 'hardware', types: ['gnd', 'pebar'] }],
      },
    ],
    check: [
      {
        question: 'When does the protective earth conductor carry current?',
        options: ['All the time', 'Only during a fault', 'Only at night'],
        answer: 1,
        explanation: 'PE carries current only when a fault connects a live part to the equipment case.',
      },
      {
        question: 'Why are PV module frames bonded?',
        options: ['To increase power output', 'To keep exposed metal at earth potential if insulation fails', 'To balance string voltages'],
        answer: 1,
        explanation: 'Bonding keeps metal frames from becoming live during an insulation fault.',
      },
      {
        question: 'What is wrong with connecting PE to a neutral or DC− terminal on a component?',
        options: ['Nothing', 'PE must never be used as a current-carrying conductor', 'It reduces voltage drop'],
        answer: 1,
        explanation: 'PE is for fault current only. SolarSketch flags PE on a current-carrying terminal as critical (TRM-002).',
      },
    ],
    practice: ['practice-grounding'],
  },
]

// ---------------------------------------------------------------------------
// Level 3 — Solar System Configurations

const level3: Lesson[] = [
  {
    id: 'system-types',
    level: 3,
    title: 'Grid-tied, off-grid and hybrid systems',
    summary: 'The three main system configurations, what each needs, and how each behaves in a brownout.',
    minutes: 10,
    sections: [
      {
        heading: 'Off-grid systems',
        paragraphs: [
          'An off-grid system has no utility connection. PV charges a battery through a charge controller, and an inverter supplies the loads from the battery. It suits remote homes, farms and island sites. The battery must cover nights and cloudy days, so off-grid systems need careful sizing; a generator is often added as backup.',
        ],
      },
      {
        heading: 'Grid-tied systems',
        paragraphs: [
          'A grid-tied (on-grid) system has no battery. A grid-tied inverter converts PV power to AC in step with the grid and feeds the house loads; any surplus flows out to the grid, and at night the house imports from the grid. With a net-metering agreement, a bidirectional meter records both directions.',
          'A grid-tied inverter must stop within a short time when the grid fails (anti-islanding), so it does not energise lines that utility workers believe are dead. That means a plain grid-tied system gives no power in a brownout, even in full sun.',
        ],
      },
      {
        heading: 'Hybrid systems',
        paragraphs: [
          'A hybrid system combines both: a hybrid inverter connects PV, a battery and the grid. It can use solar first, store surplus in the battery, draw from the grid when needed, and keep essential loads running from the battery during a brownout. A generator can be added through a transfer switch.',
        ],
        media: [
          { kind: 'illustration', id: 'system-types', caption: 'Off-grid, grid-tied and hybrid configurations. Arrows show the main directions of energy flow.' },
          { kind: 'hardware', types: ['inv', 'gti', 'hyb', 'nm'] },
        ],
      },
    ],
    check: [
      {
        question: 'During a brownout at midday, what does a plain grid-tied system without a battery supply?',
        options: ['Full PV power to the house', 'Nothing; its inverter shuts down (anti-islanding)', 'Half its rated power'],
        answer: 1,
        explanation: 'Grid-tied inverters must stop when the grid is lost, so the house loses solar power too.',
      },
      {
        question: 'Which configuration needs no utility connection?',
        options: ['Grid-tied', 'Off-grid', 'Hybrid'],
        answer: 1,
        explanation: 'Off-grid systems run independently from PV, battery and possibly a generator.',
      },
      {
        question: 'What does a hybrid inverter connect?',
        options: ['PV, battery and grid', 'Only PV and grid', 'Only battery and loads'],
        answer: 0,
        explanation: 'A hybrid inverter manages PV, a battery and the grid (and sometimes a generator).',
      },
      {
        question: 'Why must a grid-tied inverter stop when the grid fails?',
        options: ['To protect utility workers from backfed lines', 'To save battery energy', 'To reduce the electricity bill'],
        answer: 0,
        explanation: 'Anti-islanding prevents the inverter from energising a grid section that is supposed to be dead.',
      },
    ],
    practice: ['practice-grid-tied'],
  },
  {
    id: 'series-parallel',
    level: 3,
    title: 'Series and parallel module connections',
    summary: 'How strings add voltage, parallel strings add current, and why limits matter.',
    minutes: 9,
    sections: [
      {
        heading: 'Series: voltages add',
        paragraphs: ['In series, one module’s PV− connects to the next module’s PV+. The voltages add while the current stays the same as one module. A chain of modules in series is called a string.'],
        example: '2 × SLP-400M in series:  Voc = 49.5 + 49.5 = 99.0 V,  Isc = 10.4 A',
        media: [{ kind: 'walkthrough', id: 'series-build' }],
      },
      {
        heading: 'Parallel: currents add',
        paragraphs: [
          'In parallel, every PV+ joins the controller’s PV+ and every PV− joins its PV−. The currents add while the voltage stays the same as one module or string.',
          'Strings connected in parallel should have the same number of modules. Otherwise their voltages differ and the array loses power.',
        ],
        example: '2 × SLP-400M in parallel:  Voc = 49.5 V,  Isc = 10.4 + 10.4 = 20.8 A',
        media: [{ kind: 'illustration', id: 'series-parallel', caption: 'Series adds voltage at the same current; parallel adds current at the same voltage.' }],
      },
      {
        heading: 'Staying within the controller’s limits',
        paragraphs: [
          `The string’s total Voc must stay below the controller’s maximum PV input voltage. If it does not, the controller can be damaged. Voc rises in cool weather, so designers check the string at the coldest expected temperature. SolarSketch checks the STC Voc (RAT-001) and also estimates the Voc on a ${DESIGN_MIN_TEMP} °C morning from the module’s temperature coefficient (RAT-012). Highland sites get colder, so a real design uses local temperature data.`,
          'The combined current must also stay within the controller’s input rating. That is why larger arrays often use a mix: several series strings connected in parallel (for example 2S2P).',
        ],
        media: [{ kind: 'interactive', id: 'string-calc', caption: 'Try series and parallel combinations of the SLP-400M against the MPPT controller’s limits.' }],
      },
    ],
    check: [
      {
        question: 'Three 49.5 V (Voc) modules are wired in series. What is the string Voc?',
        options: ['49.5 V', '99.0 V', '148.5 V'],
        answer: 2,
        explanation: 'In series the voltages add: 3 × 49.5 V = 148.5 V.',
      },
      {
        question: 'Two identical modules are wired in parallel. What happens?',
        options: ['Voltage doubles, current stays the same', 'Current doubles, voltage stays the same', 'Both double'],
        answer: 1,
        explanation: 'Parallel connections add currents; the voltage is that of one module.',
      },
      {
        question: 'A PWM controller accepts at most 50 V. How should two 49.5 V modules be connected?',
        options: ['In series', 'In parallel', 'Either way works'],
        answer: 1,
        explanation: 'In series they would give 99 V, nearly twice the limit. In parallel the voltage stays at 49.5 V.',
      },
      {
        question: 'Four modules are arranged 2S2P. How do the voltage and current compare with one module?',
        options: ['2 × voltage, 2 × current', '4 × voltage, same current', 'Same voltage, 4 × current'],
        answer: 0,
        explanation: 'Two in series double the voltage; two such strings in parallel double the current.',
      },
    ],
    practice: ['practice-series', 'practice-parallel'],
  },
  {
    id: 'battery-configurations',
    level: 3,
    title: 'Battery bank configurations',
    summary: 'Building a bank in series and parallel, and keeping it balanced.',
    minutes: 9,
    sections: [
      {
        heading: 'Series and parallel batteries',
        paragraphs: [
          'Batteries follow the same rules as modules. In series (B− of one to B+ of the next) the voltages add and the capacity in Ah stays the same. In parallel (all B+ together, all B− together) the capacities add and the voltage stays the same. Energy (Wh) adds either way.',
          'A bank is described like an array: 2S2P means two batteries in series per string, and two strings in parallel.',
        ],
        example: '4 × 12.8 V 100 Ah as 2S2P:  25.6 V, 200 Ah, 5.12 kWh',
        media: [
          { kind: 'illustration', id: 'battery-bank', caption: 'Two 12.8 V batteries in series make a 25.6 V string. Two strings in parallel double the capacity.' },
          { kind: 'interactive', id: 'battery-calc', caption: 'Choose a battery and a series/parallel layout to see the bank voltage, capacity, energy and current limits.' },
        ],
      },
      {
        heading: 'Matching and balance',
        bullets: [
          'Use identical batteries of the same model, capacity and age. A weaker battery in a string limits the whole string and is overworked.',
          'Every parallel string must have the same voltage. Paralleling a 25.6 V string with a 12.8 V string causes a large uncontrolled current (SolarSketch rule BAT-001).',
          'Use equal-length interconnecting cables, and take the bank’s positive and negative from opposite ends (diagonally), so each string shares the current evenly.',
          'Lithium batteries can only be connected in series or parallel if the manufacturer allows it, and often only up to a stated number; their BMS units may need to communicate.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Current limits',
        paragraphs: [
          'Each battery has a maximum charge and discharge current. Parallel strings add to these limits, so a bank that must supply a large inverter often needs parallel strings even if one string has enough energy. SolarSketch compares the inverter’s full-load draw with the bank’s discharge limit (RAT-008), and the controller’s charge current with the bank’s charge limit (RAT-006).',
        ],
        media: [{ kind: 'hardware', types: ['bat'] }],
      },
    ],
    check: [
      {
        question: 'Two 12.8 V 100 Ah batteries are connected in series. What is the result?',
        options: ['12.8 V, 200 Ah', '25.6 V, 100 Ah', '25.6 V, 200 Ah'],
        answer: 1,
        explanation: 'Series adds voltage; the capacity in Ah stays that of one battery.',
      },
      {
        question: 'How much energy does a 2S2P bank of 12.8 V 100 Ah batteries store?',
        options: ['2.56 kWh', '5.12 kWh', '10.24 kWh'],
        answer: 1,
        explanation: 'Four batteries × 1.28 kWh each = 5.12 kWh (25.6 V × 200 Ah).',
      },
      {
        question: 'A 25.6 V string is paralleled with a single 12.8 V battery. What happens?',
        options: ['The bank averages to 19.2 V', 'A large uncontrolled current flows between them', 'Nothing; the BMS shares the load'],
        answer: 1,
        explanation: 'Parallel strings must have the same voltage, or the higher string discharges into the lower one.',
      },
      {
        question: 'Why might a bank need parallel strings even when one string stores enough energy?',
        options: ['To raise the voltage', 'To raise the maximum charge and discharge current', 'To reduce cable length'],
        answer: 1,
        explanation: 'Parallel strings share the current, so the bank’s current limits add.',
      },
    ],
    practice: ['practice-battery-bank'],
  },
]

// ---------------------------------------------------------------------------
// Level 4 — Solar Installation Principles

const level4: Lesson[] = [
  {
    id: 'diagrams-datasheets',
    level: 4,
    title: 'Reading diagrams and datasheets',
    summary: 'Single-line diagrams, wiring diagrams, and the datasheet values that matter for design.',
    minutes: 10,
    sections: [
      {
        heading: 'Kinds of electrical drawing',
        bullets: [
          'A single-line diagram (SLD) shows the system’s main components and how power flows between them, drawing each circuit as one line regardless of how many conductors it has. It lists ratings: module count and string layout, inverter size, breaker ratings, cable sizes.',
          'A wiring (schematic) diagram shows every conductor and terminal: PV+, PV−, L, N, PE. The SolarSketch canvas is a wiring diagram.',
          'A layout drawing shows where equipment physically sits: roof plan, equipment wall, cable routes.',
        ],
        paragraphs: ['Read a diagram from the source to the load: PV, then DC protection, then the controller or inverter, the battery, the AC protection and the loads. Check that every device has a rating and every conductor a size.'],
        media: [{ kind: 'illustration', id: 'single-line', caption: 'A simplified single-line diagram of an off-grid system. Each line stands for a whole circuit.' }],
      },
      {
        heading: 'Module datasheets',
        bullets: [
          'STC ratings: Pmax, Voc, Vmp, Isc, Imp.',
          'NOCT or NMOT ratings: output under more realistic conditions.',
          'Temperature coefficients of Pmax and Voc (in %/°C), used for the hot-day output and the cold-morning Voc.',
          'Maximum system voltage (for example 1000 V or 1500 V DC) and maximum series fuse rating.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Controller, inverter and battery datasheets',
        bullets: [
          'Charge controller: maximum PV open-circuit voltage, maximum PV input current, battery voltage, maximum charge current.',
          'Inverter: continuous and surge power, DC input voltage range, efficiency, standby (no-load) consumption, and for grid-tied units the MPPT voltage range and number of MPPT inputs.',
          'Battery: nominal voltage, capacity, maximum charge and discharge current, recommended depth of discharge, cycle life and operating temperature.',
        ],
        paragraphs: [
          'The values in SolarSketch’s built-in catalog and example equipment profiles are illustrative, not real manufacturer data. For a real design, use the manufacturer’s current datasheet for the exact model.',
        ],
      },
    ],
    check: [
      {
        question: 'What does a single-line diagram show?',
        options: ['Every individual conductor and terminal', 'The main components, power flow and ratings, with each circuit as one line', 'Only the roof layout'],
        answer: 1,
        explanation: 'An SLD simplifies each circuit to one line and focuses on components and ratings.',
      },
      {
        question: 'Which datasheet value helps estimate the highest string voltage on a cool morning?',
        options: ['Temperature coefficient of Voc', 'Rated power at NOCT', 'Module weight'],
        answer: 0,
        explanation: 'The Voc temperature coefficient tells how much Voc rises as the module cools.',
      },
      {
        question: 'Which inverter value must cover a refrigerator’s starting current?',
        options: ['Efficiency', 'Surge rating', 'AC output voltage'],
        answer: 1,
        explanation: 'Motor loads draw a brief starting surge that the inverter’s surge rating must cover.',
      },
      {
        question: 'Where should the values for a real design come from?',
        options: ['SolarSketch’s example profiles', 'The manufacturer’s current datasheet for the exact model', 'Any similar product'],
        answer: 1,
        explanation: 'Only the manufacturer’s datasheet for the exact model is a valid design source.',
      },
    ],
    practice: ['practice-analyze-system'],
  },
  {
    id: 'system-sizing',
    level: 4,
    title: 'System sizing concepts',
    summary: 'From a daily load list to battery, PV and inverter sizes.',
    minutes: 11,
    sections: [
      {
        heading: 'Start with the loads',
        paragraphs: [
          'Sizing starts with a load assessment: list every appliance, its power and the hours it runs each day. Multiply to get each appliance’s daily energy and add them up. Note which loads may run at the same time, and which have a starting surge.',
          'Reducing loads is the cheapest improvement: efficient LED lighting, an inverter-type refrigerator or aircon, and moving heavy loads to sunny hours all shrink the system.',
        ],
        media: [{ kind: 'interactive', id: 'load-sizing', caption: 'An educational sizing estimate. Adjust the loads and assumptions; the method is simplified and is not a design.' }],
      },
      {
        heading: 'Battery size',
        paragraphs: [
          'The battery must cover the energy used when there is no sun, multiplied by the number of days of autonomy, divided by the usable fraction (depth of discharge) and the inverter efficiency.',
        ],
        example: '3.0 kWh/day × 1 day ÷ (0.8 DoD × 0.93) ≈ 4.0 kWh → at 25.6 V ≈ 158 Ah, so a 200 Ah bank',
      },
      {
        heading: 'PV size',
        paragraphs: [
          'The array must replace the daily energy using the site’s peak sun hours, after losses. A common simplified estimate is: PV watts = daily energy ÷ (peak sun hours × system derating factor). The derating factor (often 0.65–0.8) covers heat, dust, wiring, controller and battery losses.',
        ],
        example: '3,000 Wh ÷ (4.5 h × 0.7) ≈ 952 W → three 400 W modules',
      },
      {
        heading: 'Inverter and controller size',
        paragraphs: [
          'The inverter’s continuous rating must exceed the total of loads that can run at the same time, with some margin, and its surge rating must cover motor starts. The charge controller must accept the array’s Voc and current and charge at a rate the battery accepts.',
          'These are educational approximations. Real sizing uses measured site data, temperature corrections, and the equipment manufacturers’ tools, and is checked by a qualified designer.',
        ],
      },
    ],
    check: [
      {
        question: 'A refrigerator draws 150 W for 24 hours. What is its daily energy?',
        options: ['150 Wh', '3.6 kWh', '6.25 kWh'],
        answer: 1,
        explanation: '150 W × 24 h = 3,600 Wh = 3.6 kWh.',
      },
      {
        question: 'What sets the minimum continuous rating of an off-grid inverter?',
        options: ['The total power of loads that can run at the same time', 'The battery capacity in Ah', 'The number of PV modules'],
        answer: 0,
        explanation: 'The inverter must carry the simultaneous load, with a margin, and cover surges.',
      },
      {
        question: 'Daily use is 2,000 Wh, the site has 4 peak sun hours, and the derating factor is 0.8. Roughly what PV size is needed?',
        options: ['500 W', '625 W', '2,000 W'],
        answer: 1,
        explanation: '2,000 ÷ (4 × 0.8) = 625 W.',
      },
      {
        question: 'Which change most cheaply reduces the size of an off-grid system?',
        options: ['Using more efficient appliances and running heavy loads in daytime', 'A larger inverter', 'Thicker AC cables'],
        answer: 0,
        explanation: 'Every kWh not used is a kWh you do not need to generate and store.',
      },
    ],
    practice: [],
  },
  {
    id: 'protection-cable-sizing',
    level: 4,
    title: 'Protection, isolation and cable sizing',
    summary: 'Coordinating cables with protective devices, and providing safe isolation points.',
    minutes: 10,
    sections: [
      {
        heading: 'Coordinating cable and protection',
        paragraphs: ['A protective device protects the cable downstream of it. The basic coordination rule is:'],
        example: 'Design current  ≤  device rating  ≤  cable ampacity (after derating)',
        bullets: [
          'The design current is what the circuit normally carries. PV circuits are commonly sized from the module short-circuit current with a safety factor (often 1.25 × Isc, with the exact factors set by the code).',
          'The device must also be able to interrupt the maximum fault current at that point, which is very high near batteries.',
          'Place overcurrent protection at the source end of the conductor it protects, for example close to the battery.',
        ],
        media: [{ kind: 'illustration', id: 'protection-map', caption: 'Protection and isolation points in an off-grid system.' }],
      },
      {
        heading: 'Isolation points',
        paragraphs: [
          'Every major component should be isolatable for maintenance: a PV array isolator near the controller or inverter, a battery isolator or breaker near the battery, and an AC isolator on the inverter output and on any grid or generator supply. Isolators are labelled and lockable.',
          'Labels at the board and the inverter warn that the system has more than one source of supply, so isolating the grid alone does not make it safe.',
        ],
      },
      {
        heading: 'Choosing a cable size',
        paragraphs: [
          'Choose the smallest conductor that passes all three checks: ampacity after derating, voltage drop within the design limit, and coordination with the protective device. Long, low-voltage DC runs are usually limited by voltage drop rather than ampacity.',
        ],
        example: '24 V battery to inverter, 134 A, 2 m run:  ampacity needs ≥ 35 mm² (125 A is not enough) → 50 mm² (151 A)',
        media: [{ kind: 'interactive', id: 'voltage-drop', caption: 'Find the smallest conductor that passes both the ampacity and the voltage-drop checks.' }],
      },
    ],
    check: [
      {
        question: 'Which order is correct for cable and protection coordination?',
        options: ['Cable ampacity ≤ device rating ≤ design current', 'Design current ≤ device rating ≤ cable ampacity', 'Device rating ≤ design current ≤ cable ampacity'],
        answer: 1,
        explanation: 'The device must carry the normal current but trip before the cable overheats.',
      },
      {
        question: 'Where is overcurrent protection for a battery cable placed?',
        options: ['At the battery end of the cable', 'At the inverter end', 'Anywhere along it'],
        answer: 0,
        explanation: 'Protection at the source end protects the whole length of the cable from fault current.',
      },
      {
        question: 'A long 24 V DC run passes the ampacity check but drops 6% of the voltage. What should you do?',
        options: ['Accept it', 'Use a larger conductor or shorten the run', 'Use a smaller breaker'],
        answer: 1,
        explanation: 'Voltage drop falls with a larger cross-section or a shorter run.',
      },
      {
        question: 'Why does a system with PV, battery and grid need warning labels at the board?',
        options: ['Because it has more than one source of supply', 'To show the electricity tariff', 'Labels are optional decoration'],
        answer: 0,
        explanation: 'Isolating one source does not make the system dead; labels warn everyone working on it.',
      },
    ],
    practice: ['practice-cable-sizing'],
  },
  {
    id: 'inspection-commissioning',
    level: 4,
    title: 'Inspection, testing and commissioning',
    summary: 'What is checked before a system is energised, and how it is proven to work.',
    minutes: 10,
    sections: [
      {
        heading: 'Installation inspection',
        paragraphs: ['Before anything is switched on, the installation is inspected against the approved design. Typical checks:'],
        bullets: [
          'Equipment matches the design: models, ratings, string layout and cable sizes.',
          'Mechanical: mounting secure, roof penetrations sealed, no cable under strain or resting on sharp edges, UV-resistant cable ties.',
          'Connections: correct polarity, terminals tightened to the specified torque, MC4 connectors fully mated.',
          'Protection and isolation devices present, correctly rated and labelled; earthing and bonding connected.',
        ],
      },
      {
        heading: 'Testing',
        paragraphs: [
          'Commissioning tests prove that what was built is safe and works. For PV systems they commonly follow IEC 62446-1 together with the local code. With the proper instruments, a qualified person typically checks: continuity of protective earth and bonding conductors; polarity of every string; open-circuit voltage of each string, compared with the expected value at the measured temperature; short-circuit or operating current; insulation resistance of the DC and AC wiring; earth electrode resistance; and operation of RCDs.',
          'A string reading far from its expected Voc points to a wrong module count, reversed or failed module, or a bad connection. In SolarSketch you can practise these readings with the Measurements tab in the inspector, on simulated faults.',
        ],
        media: [{ kind: 'hardware', types: ['dcm'] }],
      },
      {
        heading: 'Commissioning and handover',
        paragraphs: [
          'After the tests, the system is energised in a safe order and its functions are checked: the inverter starts, the charge controller detects the battery, loads run, protection devices operate, and for grid-tied systems the inverter disconnects when the grid is removed. Results are recorded, and the owner receives the documentation, test records, labels and operating instructions.',
          PRO_NOTE,
        ],
        media: [{ kind: 'walkthrough', id: 'commissioning' }],
      },
    ],
    check: [
      {
        question: 'A 3-module string reads 99 V open-circuit instead of about 148 V. What is the likely cause?',
        options: ['A module is missing, bypassed or reversed in the string', 'The battery is full', 'The sun is too bright'],
        answer: 0,
        explanation: 'Low Voc by about one module’s worth suggests a module is not contributing.',
      },
      {
        question: 'Which test checks that conductors are not leaking to earth through damaged insulation?',
        options: ['Continuity test', 'Insulation resistance test', 'Polarity test'],
        answer: 1,
        explanation: 'An insulation resistance test applies a test voltage and measures leakage through the insulation.',
      },
      {
        question: 'For a grid-tied system, which functional check is part of commissioning?',
        options: ['The inverter disconnects when the grid supply is removed', 'The modules are painted', 'The battery reaches 100% SOC'],
        answer: 0,
        explanation: 'Anti-islanding operation is verified during commissioning.',
      },
      {
        question: 'Does a clean SolarSketch validation certify a real installation?',
        options: ['Yes, it proves PEC compliance', 'No, it is an educational simulation only', 'Only for small systems'],
        answer: 1,
        explanation: 'SolarSketch is a learning tool. Real systems need inspection and testing by qualified, licensed people.',
      },
    ],
    practice: [],
  },
]

// ---------------------------------------------------------------------------
// Level 5 — Advanced Solar Systems

const level5: Lesson[] = [
  {
    id: 'mppt-hybrid',
    level: 5,
    title: 'Multiple MPPT and hybrid inverter systems',
    summary: 'Independent trackers for different roof faces, and how hybrid inverters manage PV, battery and grid.',
    minutes: 10,
    sections: [
      {
        heading: 'Multiple MPPT inputs',
        paragraphs: [
          'Each maximum power point tracker (MPPT) finds the best operating voltage for the strings connected to it. All strings on one tracker must be alike: same module, same count, same orientation. Strings that see different sunlight, such as an east and a west roof face, belong on separate trackers.',
          'Many inverters have two or more MPPT inputs, each with its own voltage and current limits. In off-grid systems the same idea is achieved with two charge controllers, each with its own array, both charging the same battery bank.',
        ],
        bullets: [
          'Check each tracker’s maximum input voltage and current separately, as well as any total limit for the inverter.',
          'Within one tracker, parallel strings must match; different trackers may have different string lengths.',
          'Microinverters take the idea furthest: each module (or pair of modules) has its own small inverter and tracker, so shading on one module does not affect the others.',
        ],
        media: [
          { kind: 'illustration', id: 'multi-mppt', caption: 'An east string and a west string on separate trackers. Each tracker optimises its own string.' },
          { kind: 'hardware', types: ['mppt', 'hyb', 'mi'] },
        ],
      },
      {
        heading: 'Hybrid inverter systems',
        paragraphs: [
          'A hybrid inverter contains the MPPT charger, battery charger and inverter in one unit, with connections for PV, battery, grid input and a load (backup) output. Loads on the backup output keep running from the battery during a brownout; loads wired on the grid side do not.',
          'Its settings decide how energy flows: which source has priority, how much battery capacity is kept in reserve for brownouts, whether and how much it may export to the grid, and when it charges from the grid.',
        ],
        bullets: [
          'The grid input and the load output must never be connected together; that would backfeed the inverter (SolarSketch rule AC-001).',
          'The battery bank must match the inverter’s battery voltage, commonly 48 V (51.2 V LiFePO4) for hybrid units.',
        ],
      },
    ],
    check: [
      {
        question: 'An east-facing and a west-facing string feed one inverter. How should they be connected?',
        options: ['In parallel on one MPPT input', 'On separate MPPT inputs', 'In series with each other'],
        answer: 1,
        explanation: 'Strings with different sunlight need their own trackers to each work at their best point.',
      },
      {
        question: 'During a brownout, which loads does a hybrid inverter keep running?',
        options: ['Every load in the house', 'Loads connected to its backup (load) output', 'None'],
        answer: 1,
        explanation: 'Only the backup output is supplied from the battery when the grid fails.',
      },
      {
        question: 'What does the hybrid inverter’s battery reserve setting do?',
        options: ['Keeps some battery capacity for brownouts instead of using it every day', 'Sets the PV voltage', 'Limits the grid voltage'],
        answer: 0,
        explanation: 'The reserve keeps energy available for outages while the grid is present.',
      },
    ],
    practice: ['practice-two-mppt'],
  },
  {
    id: 'bms-generator',
    level: 5,
    title: 'Battery management and generator integration',
    summary: 'What a BMS protects, and how a generator is added safely.',
    minutes: 9,
    sections: [
      {
        heading: 'Battery management systems (BMS)',
        paragraphs: [
          'A lithium battery’s BMS monitors every cell. It disconnects the battery if any cell goes over or under its voltage limits, if the current is too high, or if the temperature is outside the safe range. It also balances cells so that they stay at the same state of charge.',
          'Many BMS units communicate with the inverter or charger (for example over CAN or RS-485), so the charger follows the battery’s requested voltage and current. A BMS cut-off is a last line of defence; the system still needs correctly set chargers and external overcurrent protection.',
        ],
        bullets: [
          'Symptom of a BMS cut-off: the battery terminals read 0 V or the inverter reports no battery, even though the battery is not empty.',
          'Lead-acid batteries have no BMS; correct charger settings and temperature compensation protect them.',
        ],
      },
      {
        heading: 'Generator integration',
        paragraphs: [
          'A generator backs up an off-grid or hybrid system during long cloudy periods. It connects to the inverter’s AC (grid or generator) input, which charges the battery and passes power to loads, never to the inverter’s output.',
          'Where a building has both grid and generator, a transfer switch (automatic or interlocked manual) selects one source at a time, so the generator can never backfeed the grid or run in parallel with it.',
          'Many systems start the generator automatically when the battery falls to a set state of charge and stop it when the battery is recharged. The generator must be sized for the charging current plus the loads it supplies, and must be installed outdoors with exhaust kept away from openings.',
        ],
        media: [
          { kind: 'illustration', id: 'generator-ats', caption: 'A transfer switch selects grid or generator for the hybrid inverter’s AC input, never both.' },
          { kind: 'hardware', types: ['gen', 'ats'] },
        ],
      },
    ],
    check: [
      {
        question: 'Which of these does a lithium BMS do?',
        options: ['Disconnects the battery if a cell goes outside its voltage or temperature limits', 'Tracks the PV maximum power point', 'Converts DC to AC'],
        answer: 0,
        explanation: 'The BMS protects and balances the cells.',
      },
      {
        question: 'Where does a generator connect in a hybrid system?',
        options: ['To the inverter’s load (backup) output', 'To the inverter’s AC (grid/generator) input, through a transfer switch if the grid is also present', 'Directly to the battery terminals'],
        answer: 1,
        explanation: 'The generator feeds the AC input. Connecting it to the output would backfeed the inverter.',
      },
      {
        question: 'Why is a transfer switch used between grid and generator?',
        options: ['To run them in parallel for more power', 'So only one source is connected at a time and the generator cannot backfeed the grid', 'To meter exported energy'],
        answer: 1,
        explanation: 'Grid and generator must never be connected together.',
      },
      {
        question: 'Does a BMS remove the need for an external fuse or breaker?',
        options: ['Yes', 'No, external overcurrent protection is still needed', 'Only for small batteries'],
        answer: 1,
        explanation: 'The BMS is a last line of defence; cables still need fuses or breakers rated for the fault current.',
      },
    ],
    practice: [],
  },
  {
    id: 'grid-energy-management',
    level: 5,
    title: 'Grid integration and energy management',
    summary: 'Net metering in the Philippines, anti-islanding, export limits and using solar energy well.',
    minutes: 10,
    sections: [
      {
        heading: 'Grid integration and net metering',
        paragraphs: [
          'Under the Renewable Energy Act (RA 9513) and the Energy Regulatory Commission’s net-metering rules, customers can connect small renewable systems (up to 100 kW) to their distribution utility (DU) and be credited for exported energy. The DOE publishes a net-metering guidebook describing the process.',
          'The process includes an application to the DU, technical evaluation, an electrical permit and inspection, and installation of a bidirectional (net) meter by the DU. Exported energy is credited at a rate set under the rules, which is lower than the retail price of imported energy, so using solar energy on site is usually worth more than exporting it.',
        ],
        bullets: [
          'Grid-connected inverters must meet the DU’s technical requirements, including anti-islanding protection and voltage and frequency limits.',
          'Requirements and rates change; always check the current rules with the DU and the DOE/ERC.',
        ],
        media: [{ kind: 'hardware', types: ['grid', 'nm', 'gti'] }],
      },
      {
        heading: 'Energy management',
        paragraphs: [
          'Energy management means matching when energy is used with when it is produced and stored. Solar output peaks around noon, while household use often peaks in the evening.',
        ],
        bullets: [
          'Self-consumption: run washing machines, pumps, irons and water heating in sunny hours.',
          'Battery reserve: keep part of the battery for brownouts; use the rest daily.',
          'Export limiting: where export is not allowed or not worthwhile, the inverter limits output to what the house uses (zero export).',
          'Priority modes: hybrid inverters can prefer solar, battery or grid in different orders; choose the order that matches the goal (bill savings or backup).',
          'Monitoring: watching daily generation and consumption reveals faults and wasteful loads early.',
        ],
        media: [{ kind: 'illustration', id: 'energy-day', caption: 'A typical day: solar peaks at noon, while household demand peaks in the evening. The shaded area is self-consumed solar energy.' }],
      },
    ],
    check: [
      {
        question: 'Who installs the bidirectional net meter?',
        options: ['The homeowner', 'The distribution utility', 'The inverter manufacturer'],
        answer: 1,
        explanation: 'The DU installs and owns the net meter after approving the application.',
      },
      {
        question: 'Why is self-consumption usually worth more than export under net metering?',
        options: ['Export is credited at a lower rate than the retail import price', 'Export is illegal', 'Exported energy is lost'],
        answer: 0,
        explanation: 'Each kWh used on site avoids buying a kWh at the retail price.',
      },
      {
        question: 'Which load is best moved to sunny hours?',
        options: ['A washing machine', 'Evening lighting', 'A Wi-Fi router'],
        answer: 0,
        explanation: 'Flexible, high-energy loads such as laundry and pumps can run when solar is plentiful.',
      },
      {
        question: 'What is zero export?',
        options: ['The inverter limits its output so that no energy flows to the grid', 'The inverter is switched off', 'The battery is empty'],
        answer: 0,
        explanation: 'An export limit of zero keeps all solar energy on site.',
      },
    ],
    practice: [],
  },
]

export const LESSONS: Lesson[] = [...level1, ...level2, ...level3, ...level4, ...level5]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
