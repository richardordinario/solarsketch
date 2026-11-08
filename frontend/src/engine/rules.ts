/**
 * Safety rule registry (PRD §7.3). Messages with live values are produced in validation.ts;
 * this file holds the static metadata every rule must carry.
 *
 * References name the document a rule is based on, not a specific clause. Every rule is
 * educational and pending review by a qualified electrical engineer (PRD §7.4).
 */
import type { Severity } from './types'

export type RuleStage = 'Terminal' | 'AC/DC domain' | 'Polarity' | 'Ratings' | 'Topology' | 'Protection' | 'Information'

export interface RuleDef {
  id: string
  title: string
  severity: Severity
  stage: RuleStage
  /** Which components the rule applies to. */
  appliesTo: string
  /** When the rule fires. */
  detection: string
  /** Why it matters. */
  explanation: string
  /** Suggested corrective action (PRD §7.3). An issue's own fix text, with live values, takes precedence. */
  fix: string
  reference: string
  version: string
}

/** The six validation stages in order (CLAUDE.md rule 5), then information. */
export const STAGE_ORDER: Record<RuleStage, number> = { Terminal: 1, 'AC/DC domain': 2, Polarity: 3, Ratings: 4, Topology: 5, Protection: 6, Information: 7 }
export const STAGE_NAMES: readonly RuleStage[] = ['Terminal', 'AC/DC domain', 'Polarity', 'Ratings', 'Topology', 'Protection']

const PEC = 'Philippine Electrical Code (PEC), wiring and protection requirements'
const IEC62548 = 'IEC 62548-1, Photovoltaic array design requirements'
const IEC62446 = 'PNS IEC 62446-1, PV system testing, documentation and inspection'
const TESDA = 'TESDA PV Systems Installation NC II training regulations'
const DATASHEET = 'Manufacturer datasheet for the selected equipment'
const NETMETER = 'Philippine Department of Energy, Net-Metering Guidebook'

/** Rules added after v1.1.0. */
const VERSION_OF: Record<string, string> = { 'TOP-006': '1.2.0', 'TOP-007': '1.2.0', 'RAT-010': '1.2.0', 'AC-001': '1.2.0', 'AC-002': '1.2.0', 'NM-001': '1.2.0', 'RAT-011': '1.3.0', 'GND-003': '1.3.0', 'PRT-004': '1.3.0', 'RAT-012': '1.4.0', 'RAT-013': '1.4.0', 'BAT-003': '1.4.0', 'BAT-004': '1.4.0', 'SHC-001': '1.4.0', 'PRT-005': '1.4.0', 'PRT-006': '1.4.0', 'BND-001': '1.4.0', 'PRT-010': '1.4.0', 'PRT-011': '1.4.0', 'PRT-012': '1.4.0', 'PRT-013': '1.4.0', 'RAT-020': '1.4.0', 'GND-010': '1.4.0', 'INF-010': '1.4.0', 'MTR-001': '1.5.0' }

/** Suggested corrective action per rule (PRD §7.3). */
const FIX_OF: Record<string, string> = {
  'TRM-001': 'Connect the terminal to a different component.',
  'TRM-002': 'Connect PE terminals only to other PE terminals, an earth bar or a grounding rod.',
  'DOM-001': 'Keep DC and AC circuits separate; DC reaches AC loads only through an inverter.',
  'POL-001': 'Connect positive to positive and negative to negative.',
  'POL-002': 'Connect line to line and neutral to neutral.',
  'RAT-001': 'Reduce the number of modules in series, or select a controller or inverter with a higher PV input voltage.',
  'RAT-002': 'Configure the battery bank (series count) to match the equipment’s nominal DC voltage.',
  'RAT-003': 'Reduce the connected loads or select an inverter with a higher continuous rating.',
  'RAT-004': 'Select a conductor whose ampacity covers the circuit current.',
  'RAT-005': 'Use the same number of identical modules in every parallel string.',
  'RAT-006': 'Add parallel battery strings or lower the controller’s charge current limit.',
  'RAT-007': 'Shorten the cable run or use a larger conductor.',
  'RAT-008': 'Add parallel battery strings or choose a smaller inverter.',
  'RAT-009': 'Use fewer parallel strings or equipment with a higher PV input current rating.',
  'RAT-010': 'Put more modules in series so the string voltage reaches the MPPT start voltage.',
  'RAT-011': 'Move loads to another outlet on a separate circuit, or use an outlet rated for the load.',
  'RAT-012': 'Use fewer modules in series so the cold-morning Voc stays below the input limit.',
  'RAT-013': 'Select an inverter whose DC input range covers the bank from empty to charging voltage, or change the bank voltage.',
  'BAT-001': 'Give every parallel string the same number of identical batteries.',
  'BAT-002': 'Build each bank from identical batteries of the same model and age.',
  'BAT-003': 'Build each bank from one chemistry only, and set the chargers for that chemistry.',
  'BAT-004': 'Set the low-voltage disconnect near the battery voltage at the chemistry’s recommended minimum state of charge.',
  'TOP-001': 'Connect a PV module or string to the controller’s PV+ and PV−.',
  'TOP-002': 'Connect the controller’s BAT+ and BAT− to the battery bank.',
  'TOP-003': 'Connect the inverter DC+ and DC− to the battery bank (through DC protection).',
  'TOP-004': 'Connect the last module’s PV− back to the PV− input.',
  'TOP-005': 'Connect the last battery’s B− to the negative conductor.',
  'TOP-006': 'Connect a complete PV string to the inverter’s PV+ and PV−.',
  'TOP-007': 'Connect the hybrid inverter’s BAT+ and BAT− to a battery bank.',
  'SHC-001': 'Remove the conductor that joins the positive and negative, and check every series link runs − to + once.',
  'AC-001': 'Separate the AC sources, or use an automatic transfer switch to select one at a time.',
  'AC-002': 'Connect the grid-tied inverter’s AC output to the grid side of the installation.',
  'PRT-001': 'Place a DC breaker or fuse between battery B+ and the inverter DC+.',
  'PRT-003': 'Select a breaker rated for at least the circuit’s DC voltage.',
  'PRT-004': 'Feed outlets from a distribution board circuit so a breaker and RCD protect them.',
  'PRT-005': 'Use a larger conductor or a protective device rated at or below the conductor ampacity.',
  'PRT-006': 'Select a protective device rated above the circuit current (and at or below the cable ampacity).',
  'GND-001': 'Connect the inverter PE terminal to the grounding rod or the board earth bar.',
  'GND-002': 'Connect the board PE terminal to a grounding rod.',
  'GND-003': 'Run a PE conductor from the board earth bar to the outlet PE terminal.',
  'BND-001': 'Run an equipment bonding conductor from the frame or enclosure PE terminal to the earth bar or grounding rod.',
  'NM-001': 'Install a bidirectional net meter at the grid connection point.',
  'MTR-001': 'Install the CT meter at the grid connection, between the grid (or net meter) and the installation.',
  'INF-001': 'Connect the terminal or leave it as a spare.',
  'INF-002': 'Connect L and N to an inverter output, the grid side or a board circuit.',
  'PRT-010': 'Select a fuse or breaker rated at or above the circuit current and at or below the cable ampacity.',
  'PRT-011': 'Select a device rated for at least the circuit voltage (for PV, the string Voc).',
  'PRT-012': 'Add a DC SPD across PV+ and PV− near the input and connect its PE terminal to earth.',
  'PRT-013': 'Use string fuses between 1.5× and 2.4× the module Isc, and no more than the module’s maximum series fuse rating.',
  'RAT-020': 'Select a device with a higher current rating, or split the circuit.',
  'GND-010': 'Run a short PE conductor from the SPD to the earth bar or grounding rod.',
  'INF-010': 'Close the switch in the inspector when the circuit should be live.',
}

export const RULES: Record<string, RuleDef> = Object.fromEntries(
  (
    [
      ['TRM-001', 'Wire returns to the same component', 'critical', 'Terminal', 'All components', 'Both ends of a wire land on the same component.', 'The wire bypasses the component and can short its terminals.', TESDA],
      ['TRM-002', 'Protective earth on a live terminal', 'critical', 'Terminal', 'PE terminals', 'A PE terminal is wired to a current-carrying terminal.', 'PE must never carry load current; this energises exposed metal.', PEC],
      ['DOM-001', 'DC connected to AC', 'critical', 'AC/DC domain', 'All terminals', 'A DC terminal is wired to an AC terminal.', 'DC and AC circuits meet only through the inverter.', TESDA],
      ['POL-001', 'Reversed DC polarity', 'critical', 'Polarity', 'DC terminals', 'DC+ is wired to DC− outside a module or battery series link.', 'Reversed polarity can damage controllers, inverters and batteries.', DATASHEET],
      ['POL-002', 'Line connected to neutral', 'critical', 'Polarity', 'AC terminals', 'An AC line terminal is wired to a neutral terminal.', 'Line to neutral is a short circuit.', PEC],
      ['RAT-001', 'PV voltage above controller limit', 'critical', 'Ratings', 'Charge controllers', 'The highest string Voc exceeds the controller’s maximum PV input voltage.', 'Over-voltage can destroy the controller. RAT-012 also checks the higher Voc on a cold morning.', IEC62548],
      ['RAT-002', 'System voltage mismatch', 'critical', 'Ratings', 'Controllers, inverters, battery banks', 'Battery bank voltage differs from the controller or inverter DC voltage by more than 4 V.', 'Equipment must share one nominal DC system voltage.', DATASHEET],
      ['RAT-003', 'Inverter overloaded', 'warning', 'Ratings', 'Inverters', 'Connected loads exceed the inverter’s continuous rating.', 'The inverter will shut down on overload.', DATASHEET],
      ['RAT-004', 'Undersized conductor', 'warning', 'Ratings', 'Wires', 'The conductor ampacity is below the current the circuit can carry.', 'Undersized cable overheats.', PEC],
      ['RAT-005', 'Mismatched parallel PV strings', 'warning', 'Ratings', 'PV arrays', 'Parallel strings have different numbers of modules.', 'Unequal string voltages waste energy.', IEC62548],
      ['RAT-006', 'Controller current above battery charge limit', 'warning', 'Ratings', 'Controllers, battery banks', 'The controller’s maximum charge current exceeds the bank’s maximum charge current.', 'The battery can be charged faster than it is rated for.', DATASHEET],
      ['RAT-007', 'Excessive voltage drop', 'warning', 'Ratings', 'Wires', 'The estimated circuit voltage drop exceeds 3%.', 'Long or thin cables waste energy and can cause equipment to under-perform.', PEC],
      ['RAT-008', 'Inverter draw above battery discharge limit', 'warning', 'Ratings', 'Inverters, battery banks', 'The inverter’s full-load DC current exceeds the bank’s maximum discharge current.', 'The battery management system may trip or the battery may be damaged.', DATASHEET],
      ['RAT-009', 'PV current above controller input limit', 'warning', 'Ratings', 'Charge controllers', 'The array’s combined short-circuit current exceeds the controller’s maximum PV input current.', 'The controller input can be overloaded.', IEC62548],
      ['BAT-001', 'Parallel battery strings at different voltages', 'critical', 'Ratings', 'Battery banks', 'Parallel battery strings have different total nominal voltages.', 'Large currents flow between strings when they are joined.', DATASHEET],
      ['BAT-002', 'Mixed batteries in one bank', 'warning', 'Ratings', 'Battery banks', 'A bank combines batteries of different models or capacities.', 'Mismatched batteries age unevenly and the weakest one limits the bank.', DATASHEET],
      ['TOP-001', 'Controller has no PV input', 'warning', 'Topology', 'Charge controllers', 'No PV module is connected to the controller’s PV input.', 'Without PV the system cannot charge.', TESDA],
      ['TOP-002', 'Controller has no battery', 'warning', 'Topology', 'Charge controllers', 'The controller battery terminals do not reach a complete battery bank.', 'A controller needs a battery to regulate.', TESDA],
      ['TOP-003', 'Inverter has no battery', 'warning', 'Topology', 'Inverters', 'The inverter DC input does not reach a complete battery bank.', 'An off-grid inverter runs from the battery bank.', TESDA],
      ['TOP-004', 'Open PV string', 'warning', 'Topology', 'PV arrays', 'A PV string does not return to the controller’s PV− input.', 'An open circuit produces no power.', IEC62446],
      ['TOP-005', 'Open battery string', 'warning', 'Topology', 'Battery banks', 'A battery string does not return to the negative of the circuit.', 'An incomplete bank cannot supply or accept current.', TESDA],
      ['PRT-001', 'No DC protection at the battery', 'warning', 'Protection', 'Inverters, battery banks', 'No DC breaker sits between the battery bank and the inverter DC+.', 'A battery can deliver very high fault currents.', PEC],
      ['PRT-003', 'Breaker voltage rating too low', 'warning', 'Protection', 'DC breakers', 'The breaker’s maximum DC voltage is below the circuit voltage.', 'A breaker that cannot interrupt the voltage may fail to clear a fault.', DATASHEET],
      ['GND-001', 'Inverter not earthed', 'warning', 'Protection', 'Inverters', 'The inverter PE terminal is not connected to a grounding rod.', 'Exposed metal could become live during a fault.', PEC],
      ['GND-002', 'Distribution board not earthed', 'warning', 'Protection', 'Distribution boards', 'The board earth bar is not connected to a grounding rod.', 'Earth fault protection depends on a path to earth.', PEC],
      ['TOP-006', 'Inverter has no PV input', 'warning', 'Topology', 'Grid-tied and hybrid inverters', 'No complete PV string reaches the inverter’s PV input.', 'Without PV the inverter cannot generate.', TESDA],
      ['TOP-007', 'Hybrid inverter has no battery', 'warning', 'Topology', 'Hybrid inverters', 'The hybrid inverter’s battery terminals do not reach a complete battery bank.', 'Without a battery there is no backup during outages.', TESDA],
      ['RAT-010', 'String voltage below MPPT start', 'warning', 'Ratings', 'Grid-tied inverters', 'The string’s operating voltage is below the inverter’s MPPT start voltage.', 'The inverter may never start tracking, so the array produces nothing.', DATASHEET],
      ['AC-001', 'AC sources in parallel', 'critical', 'Topology', 'Inverters, grid, generators', 'Two voltage-forming AC sources share one AC network without a transfer switch, or a hybrid’s grid input is tied to its own output.', 'Sources fight each other and can backfeed the utility line, which endangers line workers.', PEC],
      ['AC-002', 'Grid-tied inverter without a grid', 'warning', 'Topology', 'Grid-tied inverters', 'The grid-tied inverter’s AC output does not reach the utility grid or a hybrid inverter output.', 'Anti-islanding protection keeps it off without a grid reference.', IEC62446],
      ['NM-001', 'No net meter at the grid connection', 'warning', 'Protection', 'Grid connection', 'A system that can export is connected to the grid without a bidirectional meter (a zero-export Smart CT meter at the grid connection means it cannot export).', 'Net-metered export must be measured by the utility’s bidirectional meter.', NETMETER],
      ['MTR-001', 'Smart CT meter not at the grid connection', 'warning', 'Topology', 'Smart CT meters', 'A Smart CT meter is on an AC network that has no utility grid.', 'The inverter limits export from the CT reading. A CT that does not see the grid flow cannot stop export, so a “zero export” setup would still push power into the utility line.', DATASHEET],
      ['RAT-011', 'Outlet overloaded', 'warning', 'Ratings', 'Convenience outlets', 'The loads plugged into an outlet (directly or through chained outlets) draw more current than the outlet’s rating.', 'An overloaded outlet and its contacts overheat, which is a common cause of house fires.', PEC],
      ['GND-003', 'Outlet not earthed', 'warning', 'Protection', 'Convenience outlets', 'The outlet PE terminal is not connected to the earthing system.', 'Appliances with metal cases rely on the outlet earth to clear a fault and to let the RCD trip.', PEC],
      ['PRT-004', 'Outlet without a protected branch circuit', 'warning', 'Protection', 'Convenience outlets', 'A supplied outlet is not fed from a distribution board circuit output.', 'Without a branch breaker and RCD, faults and overloads on the outlet are not cleared.', PEC],
      ['RAT-012', 'Cold-morning PV voltage above input limit', 'warning', 'Ratings', 'Charge controllers, grid-tied and hybrid inverters', 'The string Voc corrected to the 15 °C design minimum with the module’s Voc temperature coefficient exceeds the maximum PV input voltage.', 'Module voltage rises as cells get colder, so a string that is safe at 25 °C can exceed the input limit at dawn. Highland sites get colder than the design minimum.', IEC62548],
      ['RAT-013', 'Battery voltage outside the inverter DC input range', 'warning', 'Ratings', 'Off-grid inverters, battery banks', 'The bank’s charging voltage is above the inverter’s maximum DC input, or its empty voltage is below the minimum.', 'Above the range the inverter can be damaged or trip while the battery charges; below it the inverter cuts out early.', DATASHEET],
      ['BAT-003', 'Different chemistries in one bank', 'critical', 'Ratings', 'Battery banks', 'A bank joins lithium and lead-acid batteries, or two different lithium chemistries.', 'Each chemistry needs different charge voltages and protection. Mixed, one battery is over-charged or over-discharged; lithium cells can go into thermal runaway.', DATASHEET],
      ['BAT-004', 'Low-voltage disconnect does not suit the battery', 'warning', 'Ratings', 'Off-grid inverters, battery banks', 'The inverter’s low-voltage disconnect corresponds to a state of charge below the chemistry’s recommended minimum, or far above it.', 'Set too low, the battery is over-discharged and its life shortens; set too high, the inverter shuts down with most of the energy unused.', DATASHEET],
      ['SHC-001', 'DC short circuit', 'critical', 'Topology', 'PV modules, batteries, DC wiring', 'The positive and negative of a DC source (or of a series chain of sources) meet in one conductor, directly or through closed switches and busbars.', 'A battery short circuit can deliver thousands of amperes: cables overheat, arcs and fires start. A shorted PV string cannot be switched off in daylight.', PEC],
      ['PRT-005', 'Protective device rated above the conductor', 'warning', 'Protection', 'Breakers, fuses and switches', 'A protective device’s current rating is higher than the ampacity of a conductor it connects to.', 'The device must trip before its cable overheats; a larger rating leaves the cable unprotected.', PEC],
      ['PRT-006', 'Protective device rated below the circuit current', 'warning', 'Protection', 'Breakers and fuses', 'A protective device’s rating is below the current its circuit draws at the connected load.', 'The device trips in normal use (nuisance tripping).', PEC],
      ['BND-001', 'Equipment not bonded to earth', 'warning', 'Protection', 'PV module frames, charge controllers, battery racks', 'A connected component with a metal frame or enclosure has its PE terminal not connected to the earthing system.', 'Exposed metal can become live during an insulation fault. Bonding keeps every frame at earth potential so protection can operate.', PEC],
      ['INF-001', 'Unconnected terminal', 'info', 'Information', 'All components', 'A terminal has no wire.', 'Spare terminals are fine; this is a reminder.', TESDA],
      ['INF-002', 'Load not supplied', 'info', 'Information', 'Loads', 'A load is not connected to an inverter output.', 'The load will not run.', TESDA],
      ['PRT-010', 'Fuse or breaker rated below circuit current', 'warning', 'Protection', 'DC fuses, MCBs, MCCBs', 'The current the protected circuit can carry (sources and loads behind each side; PV at 1.25 × Isc) exceeds the device rating.', 'The device opens during normal operation, so the circuit keeps losing supply.', PEC],
      ['PRT-011', 'DC device voltage rating too low', 'warning', 'Protection', 'MC4 connectors, combiners, fuses, isolators, DC SPDs, busbars, DC meters', 'The device’s maximum DC voltage is below the circuit voltage (string Voc on the PV side, bank voltage on the battery side).', 'A DC device used above its voltage rating can arc over or fail to interrupt a fault.', IEC62548],
      ['PRT-012', 'No DC surge protection on the PV input', 'info', 'Protection', 'Charge controllers, grid-tied and hybrid inverters', 'A PV input with a connected array has no DC SPD across its PV+ and PV−.', 'Long PV cables pick up lightning surges that can damage the controller or inverter.', IEC62548],
      ['PRT-013', 'PV string fuse outside 1.5–2.4 × Isc', 'warning', 'Protection', 'PV combiner boxes', 'The combiner’s string fuse rating is below 1.5 × or above 2.4 × the module short-circuit current.', 'Too small a fuse blows in normal sun; too large a fuse does not protect a module from reverse current from parallel strings.', IEC62548],
      ['RAT-020', 'Inline device current above rating', 'warning', 'Ratings', 'Connectors, combiners, isolators, disconnects, RCCBs, busbars, meters', 'The current that can flow through the device exceeds its rated current.', 'Contacts and terminals overheat when they carry more than their rating.', DATASHEET],
      ['GND-010', 'Surge protective device not earthed', 'warning', 'Protection', 'DC and AC SPDs', 'The SPD PE terminal is not connected to the earthing system.', 'An SPD diverts surge current to earth; without an earth path it does nothing.', PEC],
      ['INF-010', 'Switch open', 'info', 'Information', 'Isolators, disconnects, breakers, RCCBs', 'An isolator, disconnect, breaker or RCCB is set to open.', 'Everything beyond the open switch is de-energised, which is intended during maintenance.', TESDA],
    ] as const
  ).map(([id, title, severity, stage, appliesTo, detection, explanation, reference]) => [id, { id, title, severity, stage, appliesTo, detection, explanation, fix: FIX_OF[id] ?? '', reference, version: VERSION_OF[id] ?? '1.1.0' }]),
)

export const ruleById = (id: string): RuleDef | undefined => RULES[id]

/** Stage number of a rule (1–6, 7 information); unknown rules sort with information. */
export const stageOf = (id: string) => STAGE_ORDER[RULES[id]?.stage ?? 'Information']

/** The corrective action to show: the issue's own (with live values), else the registry's. */
export const fixFor = (issue: { rule: string; fix?: string }) => issue.fix || RULES[issue.rule]?.fix || ''
