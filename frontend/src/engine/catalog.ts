import { COMPONENT_META } from './catalog-meta'
import type { BaseComponentDef, ComponentDef, ComponentType, LabNode, TerminalType } from './types'

export const RULESET_VERSION = '1.4.0'
export const CATALOG_VERSION = '2027.04'

const BASE: Record<ComponentType, BaseComponentDef> = {
  pv: { code: 'PV', name: 'Mono PV Module', cat: 'Solar Generation', model: 'SLP-400M', ver: 4, L: [['pe', 'Frame PE', 'pe']], R: [['p', 'PV+', 'dc+'], ['n', 'PV−', 'dc-']], specs: [['ratedPower', 'Rated power (STC)', 'W', 400], ['voc', 'Open-circuit voltage', 'V', 49.5], ['vmp', 'Max-power voltage', 'V', 41.2], ['isc', 'Short-circuit current', 'A', 10.4], ['tcP', 'Power temperature coefficient', '%/°C', -0.35], ['tcVoc', 'Voc temperature coefficient', '%/°C', -0.27], ['noct', 'NOCT (cell temperature)', '°C', 45], ['tilt', 'Tilt angle', '°', 10], ['azimuth', 'Azimuth (180 = south)', '°', 180]], doc: 'SLP-400M datasheet, rev. C' },
  mppt: { code: 'CC', name: 'MPPT Charge Controller', cat: 'Charge Controllers', model: 'SLC-6015', ver: 4, L: [['pvp', 'PV+', 'dc+'], ['pvn', 'PV−', 'dc-']], R: [['bp', 'BAT+', 'dc+'], ['bn', 'BAT−', 'dc-'], ['pe', 'PE', 'pe']], specs: [['maxPvV', 'Max PV input voltage', 'V', 150], ['maxPvI', 'Max PV input current', 'A', 36], ['maxI', 'Max charge current', 'A', 60], ['nomV', 'Battery system voltage', 'V', 24], ['eff', 'Efficiency', '%', 97]], doc: 'SLC-6015 manual, section 4' },
  pwm: { code: 'CC', name: 'PWM Charge Controller', cat: 'Charge Controllers', model: 'SLC-P30', ver: 3, L: [['pvp', 'PV+', 'dc+'], ['pvn', 'PV−', 'dc-']], R: [['bp', 'BAT+', 'dc+'], ['bn', 'BAT−', 'dc-'], ['pe', 'PE', 'pe']], specs: [['maxPvV', 'Max PV input voltage', 'V', 50], ['maxPvI', 'Max PV input current', 'A', 30], ['maxI', 'Max charge current', 'A', 30], ['nomV', 'Battery system voltage', 'V', 24], ['eff', 'Efficiency', '%', 80]], doc: 'SLC-P30 manual' },
  bat: { code: 'BAT', name: 'LiFePO4 Battery', cat: 'Battery Systems', model: 'SLB-24200', ver: 5, L: [['p', 'B+', 'dc+'], ['n', 'B−', 'dc-']], R: [['pe', 'Case PE', 'pe']], specs: [['nomV', 'Nominal voltage', 'V', 25.6], ['ah', 'Capacity', 'Ah', 200], ['maxC', 'Max charge current', 'A', 100], ['maxD', 'Max discharge current', 'A', 150]], doc: 'SLB-24200 datasheet, rev. B' },
  dcb: { code: 'DCB', name: 'DC Circuit Breaker', cat: 'DC Protection', model: 'SDB-263', ver: 1, L: [['i', 'LINE', 'dc']], R: [['o', 'LOAD', 'dc']], specs: [['ratedI', 'Rated current', 'A', 63], ['maxV', 'Max DC voltage', 'V', 250]], doc: 'SDB-263 datasheet' },
  inv: { code: 'INV', name: 'Off-grid Inverter', cat: 'Inverters', model: 'SIV-3024', ver: 3, L: [['dp', 'DC+', 'dc+'], ['dn', 'DC−', 'dc-']], R: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n'], ['pe', 'PE', 'pe']], specs: [['nomV', 'Nominal DC input', 'V', 24], ['ratedP', 'Continuous output', 'W', 3000], ['eff', 'Efficiency', '%', 93], ['acV', 'AC output voltage', 'V', 230], ['freq', 'AC frequency', 'Hz', 60], ['surgeP', 'Surge rating (motor start)', 'W', 6000], ['minDcV', 'Min DC input voltage', 'V', 21], ['maxDcV', 'Max DC input voltage', 'V', 32], ['lvd', 'Low-voltage disconnect', 'V', 25], ['lvr', 'Low-voltage reconnect', 'V', 25.6], ['shedSoc', 'Shed non-essential loads below SOC', '%', 30]], doc: 'SIV-3024 installation guide' },
  acdb: { code: 'ACDB', name: 'AC Distribution Board', cat: 'Distribution Equipment', model: 'SAD-2W', ver: 1, L: [['l', 'L in', 'ac-l'], ['n', 'N in', 'ac-n'], ['pe', 'PE', 'pe']], R: [['l1', 'L1', 'ac-l'], ['n1', 'N1', 'ac-n'], ['l2', 'L2', 'ac-l'], ['n2', 'N2', 'ac-n']], bus: [['l', 'l1', 'l2'], ['n', 'n1', 'n2']], specs: [['ratedI', 'Busbar rating', 'A', 32], ['rcd', 'RCD trip current', 'mA', 30]], doc: 'SAD-2W wiring diagram' },
  outlet: { code: 'OUT', name: 'Convenience Outlet', cat: 'Distribution Equipment', model: 'SCO-15D duplex', ver: 1, L: [['l', 'L in', 'ac-l'], ['n', 'N in', 'ac-n'], ['pe', 'PE', 'pe']], R: [['l1', 'Socket 1 L', 'ac-l'], ['n1', 'Socket 1 N', 'ac-n'], ['l2', 'Socket 2 L', 'ac-l'], ['n2', 'Socket 2 N', 'ac-n']], bus: [['l', 'l1', 'l2'], ['n', 'n1', 'n2']], specs: [['ratedI', 'Rated current', 'A', 15], ['maxV', 'Rated voltage', 'V', 250]], doc: 'SCO-15D duplex outlet data' },
  gnd: { code: 'GND', name: 'Grounding Rod', cat: 'Grounding and Protection', model: 'SGR-16', ver: 1, L: [['pe', 'PE', 'pe']], R: [], specs: [['res', 'Earth resistance', 'Ω', 10]], doc: 'Grounding basics, lesson 2.8' },
  led: { code: 'LOAD', name: 'LED Lighting', cat: 'Electrical Loads', model: 'Generic', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 60], ['on', 'On from', 'h', 18], ['off', 'Off at', 'h', 23], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 1]], doc: 'Load profiles, lesson 3.4' },
  fan: { code: 'LOAD', name: 'Electric Fan', cat: 'Electrical Loads', model: 'Generic', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 75], ['on', 'On from', 'h', 10], ['off', 'Off at', 'h', 18], ['surge', 'Startup surge (× rated)', '×', 2], ['priority', 'Priority (1 essential, 3 non-essential)', '', 2]], doc: 'Load profiles, lesson 3.4' },
  fridge: { code: 'LOAD', name: 'Refrigerator', cat: 'Electrical Loads', model: 'Generic', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 150], ['on', 'On from', 'h', 0], ['off', 'Off at', 'h', 24], ['surge', 'Startup surge (× rated)', '×', 3], ['priority', 'Priority (1 essential, 3 non-essential)', '', 1]], doc: 'Load profiles, lesson 3.4' },
  gti: { code: 'GTI', name: 'Grid-tied Inverter', cat: 'Inverters', model: 'SGT-3000', ver: 1, L: [['pvp', 'PV+', 'dc+'], ['pvn', 'PV−', 'dc-']], R: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n'], ['pe', 'PE', 'pe']], specs: [['ratedP', 'Rated AC output', 'W', 3000], ['maxPvV', 'Max PV input voltage', 'V', 550], ['minPvV', 'MPPT start voltage', 'V', 120], ['maxPvI', 'Max PV input current', 'A', 13], ['eff', 'Efficiency', '%', 97], ['acV', 'AC voltage', 'V', 230]], doc: 'SGT-3000 installation guide' },
  hyb: { code: 'HYB', name: 'Hybrid Inverter', cat: 'Inverters', model: 'SHY-5048', ver: 2, L: [['pvp', 'PV+', 'dc+'], ['pvn', 'PV−', 'dc-'], ['bp', 'BAT+', 'dc+'], ['bn', 'BAT−', 'dc-']], R: [['gl', 'Grid L', 'ac-l'], ['gn', 'Grid N', 'ac-n'], ['l', 'Load L', 'ac-l'], ['n', 'Load N', 'ac-n'], ['pe', 'PE', 'pe']], specs: [['ratedP', 'Continuous output', 'W', 5000], ['nomV', 'Battery voltage', 'V', 48], ['maxPvV', 'Max PV input voltage', 'V', 450], ['maxPvI', 'Max PV input current', 'A', 18], ['maxI', 'Max battery charge current', 'A', 100], ['eff', 'Efficiency', '%', 95], ['acV', 'AC output voltage', 'V', 230], ['reserveSoc', 'Battery reserve (grid present)', '%', 30], ['exportLimit', 'Grid export limit', 'W', 5000], ['freq', 'AC frequency', 'Hz', 60], ['surgeP', 'Surge rating (motor start)', 'W', 10000]], doc: 'SHY-5048 user manual' },
  grid: { code: 'GRID', name: 'Utility Grid', cat: 'Grid and Backup Integration', model: 'Distribution utility service', ver: 1, L: [], R: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n'], ['pe', 'PE', 'pe']], specs: [['acV', 'Supply voltage', 'V', 230], ['serviceA', 'Service rating', 'A', 60], ['tariff', 'Import tariff', '₱/kWh', 12], ['credit', 'Export credit', '₱/kWh', 6]], doc: 'DOE Net-Metering Guidebook' },
  nm: { code: 'NM', name: 'Net Meter', cat: 'Grid and Backup Integration', model: 'Bidirectional kWh meter', ver: 1, L: [['gl', 'Grid L', 'ac-l'], ['gn', 'Grid N', 'ac-n']], R: [['l', 'Load L', 'ac-l'], ['n', 'Load N', 'ac-n']], specs: [['ratedI', 'Rated current', 'A', 60]], doc: 'DOE Net-Metering Guidebook' },
  gen: { code: 'GEN', name: 'Generator', cat: 'Grid and Backup Integration', model: 'SGN-3000', ver: 1, L: [], R: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n'], ['pe', 'PE', 'pe']], specs: [['ratedP', 'Continuous output', 'W', 3000], ['acV', 'Output voltage', 'V', 230], ['startSoc', 'Auto-start below SOC', '%', 20], ['stopSoc', 'Auto-stop at SOC', '%', 80]], doc: 'SGN-3000 operator manual' },
  ats: { code: 'ATS', name: 'Automatic Transfer Switch', cat: 'Grid and Backup Integration', model: 'SAT-40', ver: 1, L: [['ml', 'Main L', 'ac-l'], ['mn', 'Main N', 'ac-n'], ['bl', 'Backup L', 'ac-l'], ['bkn', 'Backup N', 'ac-n']], R: [['l', 'Out L', 'ac-l'], ['n', 'Out N', 'ac-n']], specs: [['ratedI', 'Rated current', 'A', 40]], doc: 'SAT-40 wiring diagram' },
  tv: { code: 'LOAD', name: 'Television', cat: 'Electrical Loads', model: 'Generic', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 90], ['on', 'On from', 'h', 19], ['off', 'Off at', 'h', 22], ['surge', 'Startup surge (× rated)', '×', 1.5], ['priority', 'Priority (1 essential, 3 non-essential)', '', 2]], doc: 'Load profiles, lesson 3.4' },
  acw: { code: 'LOAD', name: 'Aircon (Window Type)', cat: 'Electrical Loads', model: '1 HP window type', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 900], ['on', 'On from', 'h', 13], ['off', 'Off at', 'h', 17], ['surge', 'Startup surge (× rated)', '×', 3], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  acs: { code: 'LOAD', name: 'Aircon (Split Type)', cat: 'Electrical Loads', model: '1 HP inverter split type', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 650], ['on', 'On from', 'h', 21], ['off', 'Off at', 'h', 5], ['surge', 'Startup surge (× rated)', '×', 1.5], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  pc: { code: 'LOAD', name: 'Desktop Computer Set', cat: 'Electrical Loads', model: 'PC tower + monitor', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 250], ['on', 'On from', 'h', 8], ['off', 'Off at', 'h', 17], ['surge', 'Startup surge (× rated)', '×', 1.5], ['priority', 'Priority (1 essential, 3 non-essential)', '', 2]], doc: 'Load profiles, lesson 3.4' },
  laptop: { code: 'LOAD', name: 'Laptop', cat: 'Electrical Loads', model: 'Generic', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 65], ['on', 'On from', 'h', 18], ['off', 'Off at', 'h', 22], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 2]], doc: 'Load profiles, lesson 3.4' },
  router: { code: 'LOAD', name: 'Wi-Fi Router', cat: 'Electrical Loads', model: 'Generic', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 12], ['on', 'On from', 'h', 0], ['off', 'Off at', 'h', 24], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 1]], doc: 'Load profiles, lesson 3.4' },
  rice: { code: 'LOAD', name: 'Rice Cooker', cat: 'Electrical Loads', model: '1.0 L', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 500], ['on', 'On from', 'h', 5], ['off', 'Off at', 'h', 5.5], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 2]], doc: 'Load profiles, lesson 3.4' },
  kettle: { code: 'LOAD', name: 'Electric Kettle', cat: 'Electrical Loads', model: '1.7 L', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 1500], ['on', 'On from', 'h', 6], ['off', 'Off at', 'h', 6.25], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  micro: { code: 'LOAD', name: 'Microwave Oven', cat: 'Electrical Loads', model: '20 L', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 1000], ['on', 'On from', 'h', 12], ['off', 'Off at', 'h', 12.25], ['surge', 'Startup surge (× rated)', '×', 2], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  induc: { code: 'LOAD', name: 'Induction Cooker', cat: 'Electrical Loads', model: 'Single burner', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 1800], ['on', 'On from', 'h', 17], ['off', 'Off at', 'h', 17.75], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  wash: { code: 'LOAD', name: 'Washing Machine', cat: 'Electrical Loads', model: 'Twin tub, 7 kg', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 400], ['on', 'On from', 'h', 9], ['off', 'Off at', 'h', 11], ['surge', 'Startup surge (× rated)', '×', 3], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  iron: { code: 'LOAD', name: 'Flat Iron', cat: 'Electrical Loads', model: 'Dry/steam', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 1000], ['on', 'On from', 'h', 7], ['off', 'Off at', 'h', 7.5], ['surge', 'Startup surge (× rated)', '×', 1], ['priority', 'Priority (1 essential, 3 non-essential)', '', 3]], doc: 'Load profiles, lesson 3.4' },
  pump: { code: 'LOAD', name: 'Water Pump', cat: 'Electrical Loads', model: '½ HP jet pump', ver: 2, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [], specs: [['p', 'Rated power', 'W', 375], ['on', 'On from', 'h', 6], ['off', 'Off at', 'h', 6.5], ['surge', 'Startup surge (× rated)', '×', 3], ['priority', 'Priority (1 essential, 3 non-essential)', '', 2]], doc: 'Load profiles, lesson 3.4' },
  // ---- Solar connectors (PRD §4.1 B) ----
  mc4: { code: 'MC4', name: 'MC4 Connector Pair', cat: 'Solar Connectors', model: 'MC4-type, 30 A · 1000 V', ver: 1, L: [['ip', '+ in', 'dc+'], ['in', '− in', 'dc-']], R: [['op', '+ out', 'dc+'], ['on', '− out', 'dc-']], bus: [['ip', 'op'], ['in', 'on']], specs: [['ratedI', 'Rated current', 'A', 30], ['maxV', 'Max DC voltage', 'V', 1000]], doc: 'MC4-type connector, example values' },
  ybr: { code: 'MC4Y', name: 'MC4 Y-Branch Connector', cat: 'Solar Connectors', model: 'MC4-type 2-to-1 branch pair', ver: 1, L: [['p1', '+ in 1', 'dc+'], ['p2', '+ in 2', 'dc+'], ['n1', '− in 1', 'dc-'], ['n2', '− in 2', 'dc-']], R: [['po', '+ out', 'dc+'], ['no', '− out', 'dc-']], bus: [['po', 'p1', 'p2'], ['no', 'n1', 'n2']], specs: [['ratedI', 'Rated current', 'A', 30], ['maxV', 'Max DC voltage', 'V', 1000]], doc: 'MC4-type branch connector, example values' },
  // ---- DC protection (PRD §4.1 F) ----
  fuse: { code: 'FU', name: 'DC Fuse with Holder', cat: 'DC Protection', model: 'Fuse holder + 160 A DC fuse', ver: 1, L: [['i', 'LINE', 'dc']], R: [['o', 'LOAD', 'dc']], sw: [['i', 'o']], specs: [['ratedI', 'Fuse rating', 'A', 160], ['maxV', 'Max DC voltage', 'V', 125]], doc: 'DC fuse and holder, example values' },
  iso: { code: 'ISO', name: 'DC Isolator Switch', cat: 'DC Protection', model: '2-pole DC isolator / battery disconnect', ver: 1, L: [['ip', '+ in', 'dc+'], ['in', '− in', 'dc-']], R: [['op', '+ out', 'dc+'], ['on', '− out', 'dc-']], sw: [['ip', 'op'], ['in', 'on']], specs: [['closed', 'Switch closed', '', 1], ['ratedI', 'Rated current', 'A', 125], ['maxV', 'Max DC voltage', 'V', 150]], doc: 'DC isolator, example values' },
  dspd: { code: 'SPD', name: 'DC Surge Protective Device', cat: 'DC Protection', model: 'Type 2 PV SPD, 2P + PE', ver: 1, L: [['p', '+', 'dc+'], ['n', '−', 'dc-']], R: [['pe', 'PE', 'pe']], specs: [['maxV', 'Max continuous voltage', 'V', 600], ['imax', 'Max discharge current', 'kA', 40]], doc: 'PV surge protective device, example values' },
  // ---- AC protection (PRD §4.1 G) ----
  mcb: { code: 'MCB', name: 'Miniature Circuit Breaker', cat: 'AC Protection', model: 'MCB 1P, curve C', ver: 1, L: [['l', 'L in', 'ac-l']], R: [['lo', 'L out', 'ac-l']], sw: [['l', 'lo']], specs: [['closed', 'Breaker closed', '', 1], ['ratedI', 'Rated current', 'A', 20], ['icu', 'Breaking capacity', 'kA', 6]], doc: 'MCB, example values' },
  mccb: { code: 'MCCB', name: 'Moulded-Case Circuit Breaker', cat: 'AC Protection', model: 'MCCB 1P, 100 A frame', ver: 1, L: [['l', 'L in', 'ac-l']], R: [['lo', 'L out', 'ac-l']], sw: [['l', 'lo']], specs: [['closed', 'Breaker closed', '', 1], ['ratedI', 'Rated current', 'A', 100], ['icu', 'Breaking capacity', 'kA', 25]], doc: 'MCCB, example values' },
  rccb: { code: 'RCD', name: 'RCCB (Residual-Current Device)', cat: 'AC Protection', model: 'RCCB 2P, 40 A', ver: 1, L: [['l', 'L in', 'ac-l'], ['n', 'N in', 'ac-n']], R: [['lo', 'L out', 'ac-l'], ['no', 'N out', 'ac-n']], sw: [['l', 'lo'], ['n', 'no']], specs: [['closed', 'Switch closed', '', 1], ['ratedI', 'Rated current', 'A', 40], ['rcd', 'RCD trip current', 'mA', 30]], doc: 'RCCB, example values' },
  aspd: { code: 'SPD', name: 'AC Surge Protective Device', cat: 'AC Protection', model: 'Type 2 SPD, 1P + N', ver: 1, L: [['l', 'L', 'ac-l'], ['n', 'N', 'ac-n']], R: [['pe', 'PE', 'pe']], specs: [['maxV', 'Max continuous voltage', 'V', 275], ['imax', 'Max discharge current', 'kA', 40]], doc: 'AC surge protective device, example values' },
  acsw: { code: 'ACSW', name: 'AC Disconnect Switch', cat: 'AC Protection', model: '2P load-break isolator', ver: 1, L: [['l', 'L in', 'ac-l'], ['n', 'N in', 'ac-n']], R: [['lo', 'L out', 'ac-l'], ['no', 'N out', 'ac-n']], sw: [['l', 'lo'], ['n', 'no']], specs: [['closed', 'Switch closed', '', 1], ['ratedI', 'Rated current', 'A', 32], ['maxV', 'Rated voltage', 'V', 400]], doc: 'AC isolator, example values' },
  // ---- Distribution (PRD §4.1 H) and grounding (§4.1 I) ----
  cbx: { code: 'CBX', name: 'PV Combiner Box', cat: 'Distribution Equipment', model: '3-string combiner, fused', ver: 1, L: [['p1', 'String 1 +', 'dc+'], ['n1', 'String 1 −', 'dc-'], ['p2', 'String 2 +', 'dc+'], ['n2', 'String 2 −', 'dc-'], ['p3', 'String 3 +', 'dc+'], ['n3', 'String 3 −', 'dc-']], R: [['po', 'PV+ out', 'dc+'], ['no', 'PV− out', 'dc-'], ['pe', 'PE', 'pe']], bus: [['po', 'p1', 'p2', 'p3'], ['no', 'n1', 'n2', 'n3']], specs: [['fuseA', 'String fuse rating', 'A', 15], ['ratedI', 'Output rating', 'A', 40], ['maxV', 'Max DC voltage', 'V', 1000]], doc: 'PV combiner box, example values' },
  dbus: { code: 'DCBB', name: 'DC Distribution Busbar', cat: 'Distribution Equipment', model: '4-way + / − busbar pair', ver: 1, L: [['p1', '+ 1', 'dc+'], ['n1', '− 1', 'dc-'], ['p2', '+ 2', 'dc+'], ['n2', '− 2', 'dc-']], R: [['p3', '+ 3', 'dc+'], ['n3', '− 3', 'dc-'], ['p4', '+ 4', 'dc+'], ['n4', '− 4', 'dc-']], bus: [['p1', 'p2', 'p3', 'p4'], ['n1', 'n2', 'n3', 'n4']], specs: [['ratedI', 'Busbar rating', 'A', 250], ['maxV', 'Max DC voltage', 'V', 60]], doc: 'DC busbar, example values' },
  pebar: { code: 'PE', name: 'Earth Busbar', cat: 'Grounding and Protection', model: '6-way PE terminal block', ver: 1, L: [['e1', 'PE 1', 'pe'], ['e2', 'PE 2', 'pe'], ['e3', 'PE 3', 'pe']], R: [['e4', 'PE 4', 'pe'], ['e5', 'PE 5', 'pe'], ['e6', 'PE 6', 'pe']], bus: [['e1', 'e2', 'e3', 'e4', 'e5', 'e6']], specs: [['csa', 'Max conductor size', 'mm²', 16]], doc: 'Earth busbar, example values' },
  // ---- Electrical measurement (PRD §4.1 J) ----
  dcm: { code: 'DCM', name: 'DC Power Meter with Shunt', cat: 'Electrical Measurement', model: 'Shunt meter, 200 A / 75 mV', ver: 1, L: [['bn', 'Shunt (source −)', 'dc-'], ['vp', 'V+ sense', 'dc+']], R: [['ln', 'Shunt (load −)', 'dc-']], bus: [['bn', 'ln']], specs: [['ratedI', 'Shunt rating', 'A', 200], ['maxV', 'Max DC voltage', 'V', 100]], doc: 'DC shunt meter, example values' },
  acm: { code: 'kWh', name: 'AC Energy Meter', cat: 'Electrical Measurement', model: 'DIN-rail kWh meter, 1P', ver: 1, L: [['l', 'L in', 'ac-l'], ['n', 'N in', 'ac-n']], R: [['lo', 'L out', 'ac-l'], ['no', 'N out', 'ac-n']], bus: [['l', 'lo'], ['n', 'no']], specs: [['ratedI', 'Rated current', 'A', 63]], doc: 'AC energy meter, example values' },
  // ---- Inverters (PRD §4.1 E) ----
  mi: { code: 'MI', name: 'Microinverter', cat: 'Inverters', model: 'SMI-400', ver: 1, L: [['pvp', 'PV+', 'dc+'], ['pvn', 'PV−', 'dc-']], R: [['l', 'AC L', 'ac-l'], ['n', 'AC N', 'ac-n'], ['lo', 'AC L (next)', 'ac-l'], ['no', 'AC N (next)', 'ac-n'], ['pe', 'PE', 'pe']], bus: [['l', 'lo'], ['n', 'no']], specs: [['ratedP', 'Rated AC output', 'W', 380], ['maxPvV', 'Max PV input voltage', 'V', 60], ['minPvV', 'MPPT start voltage', 'V', 22], ['maxPvI', 'Max PV input current', 'A', 14], ['eff', 'Efficiency', '%', 96.5], ['acV', 'AC voltage', 'V', 230]], doc: 'SMI-400 installation guide (example)' },
  // ---- PV module variants (PRD §4.1 A); illustrative example values ----
  pvpoly: { code: 'PV', name: 'Poly PV Module', cat: 'Solar Generation', model: 'SLP-330P', ver: 1, L: [['pe', 'Frame PE', 'pe']], R: [['p', 'PV+', 'dc+'], ['n', 'PV−', 'dc-']], specs: [['ratedPower', 'Rated power (STC)', 'W', 330], ['voc', 'Open-circuit voltage', 'V', 46.2], ['vmp', 'Max-power voltage', 'V', 37.4], ['isc', 'Short-circuit current', 'A', 9.4], ['tcP', 'Power temperature coefficient', '%/°C', -0.4], ['tcVoc', 'Voc temperature coefficient', '%/°C', -0.31], ['noct', 'NOCT (cell temperature)', '°C', 45], ['tilt', 'Tilt angle', '°', 10], ['azimuth', 'Azimuth (180 = south)', '°', 180]], doc: 'SLP-330P datasheet (example)' },
  pvbif: { code: 'PV', name: 'Bifacial PV Module', cat: 'Solar Generation', model: 'SLP-450B glass-glass', ver: 1, L: [['pe', 'Frame PE', 'pe']], R: [['p', 'PV+', 'dc+'], ['n', 'PV−', 'dc-']], specs: [['ratedPower', 'Rated power (STC, front)', 'W', 450], ['voc', 'Open-circuit voltage', 'V', 50.2], ['vmp', 'Max-power voltage', 'V', 41.8], ['isc', 'Short-circuit current', 'A', 11.4], ['tcP', 'Power temperature coefficient', '%/°C', -0.3], ['tcVoc', 'Voc temperature coefficient', '%/°C', -0.25], ['noct', 'NOCT (cell temperature)', '°C', 44], ['tilt', 'Tilt angle', '°', 15], ['azimuth', 'Azimuth (180 = south)', '°', 180], ['bifi', 'Bifacial rear-side gain', '%', 8]], doc: 'SLP-450B datasheet (example)' },
  pvflex: { code: 'PV', name: 'Flexible PV Panel', cat: 'Solar Generation', model: 'SLF-100 thin flexible', ver: 1, L: [], R: [['p', 'PV+', 'dc+'], ['n', 'PV−', 'dc-']], specs: [['ratedPower', 'Rated power (STC)', 'W', 100], ['voc', 'Open-circuit voltage', 'V', 22.5], ['vmp', 'Max-power voltage', 'V', 18.6], ['isc', 'Short-circuit current', 'A', 5.8], ['tcP', 'Power temperature coefficient', '%/°C', -0.38], ['tcVoc', 'Voc temperature coefficient', '%/°C', -0.29], ['noct', 'NOCT (cell temperature)', '°C', 50], ['tilt', 'Tilt angle', '°', 0], ['azimuth', 'Azimuth (180 = south)', '°', 180]], doc: 'SLF-100 datasheet (example)' },
  pvport: { code: 'PV', name: 'Portable Folding PV Panel', cat: 'Solar Generation', model: 'SLX-200 folding', ver: 1, L: [], R: [['p', 'PV+', 'dc+'], ['n', 'PV−', 'dc-']], specs: [['ratedPower', 'Rated power (STC)', 'W', 200], ['voc', 'Open-circuit voltage', 'V', 24], ['vmp', 'Max-power voltage', 'V', 19.8], ['isc', 'Short-circuit current', 'A', 10.6], ['tcP', 'Power temperature coefficient', '%/°C', -0.37], ['tcVoc', 'Voc temperature coefficient', '%/°C', -0.28], ['noct', 'NOCT (cell temperature)', '°C', 47], ['tilt', 'Tilt angle', '°', 30], ['azimuth', 'Azimuth (180 = south)', '°', 180]], doc: 'SLX-200 user guide (example)' },
  // ---- Battery chemistries (PRD §4.1 D, §6.3); parameters in battery-chem.ts ----
  batfla: { code: 'BAT', name: 'Flooded Lead-acid Battery', cat: 'Battery Systems', model: 'SLB-12100F deep cycle', ver: 1, L: [['p', 'B+', 'dc+'], ['n', 'B−', 'dc-']], R: [], specs: [['nomV', 'Nominal voltage', 'V', 12], ['ah', 'Capacity (C20)', 'Ah', 100], ['maxC', 'Max charge current', 'A', 20], ['maxD', 'Max discharge current', 'A', 50]], doc: 'SLB-12100F datasheet (example)' },
  batagm: { code: 'BAT', name: 'AGM Battery', cat: 'Battery Systems', model: 'SLB-12100A VRLA', ver: 1, L: [['p', 'B+', 'dc+'], ['n', 'B−', 'dc-']], R: [], specs: [['nomV', 'Nominal voltage', 'V', 12], ['ah', 'Capacity (C20)', 'Ah', 100], ['maxC', 'Max charge current', 'A', 30], ['maxD', 'Max discharge current', 'A', 100]], doc: 'SLB-12100A datasheet (example)' },
  batgel: { code: 'BAT', name: 'Gel Battery', cat: 'Battery Systems', model: 'SLB-12100G VRLA gel', ver: 1, L: [['p', 'B+', 'dc+'], ['n', 'B−', 'dc-']], R: [], specs: [['nomV', 'Nominal voltage', 'V', 12], ['ah', 'Capacity (C20)', 'Ah', 100], ['maxC', 'Max charge current', 'A', 20], ['maxD', 'Max discharge current', 'A', 50]], doc: 'SLB-12100G datasheet (example)' },
  batnmc: { code: 'BAT', name: 'Li-ion NMC Battery', cat: 'Battery Systems', model: 'SLB-26100N', ver: 1, L: [['p', 'B+', 'dc+'], ['n', 'B−', 'dc-']], R: [['pe', 'Case PE', 'pe']], specs: [['nomV', 'Nominal voltage', 'V', 25.9], ['ah', 'Capacity', 'Ah', 100], ['maxC', 'Max charge current', 'A', 50], ['maxD', 'Max discharge current', 'A', 100]], doc: 'SLB-26100N datasheet (example)' },
}

/** Component definitions (PRD §4.2): catalog data merged with its descriptive metadata. */
export const CATALOG = Object.fromEntries((Object.keys(BASE) as ComponentType[]).map((k) => [k, { ...BASE[k], ...COMPONENT_META[k] }])) as Record<ComponentType, ComponentDef>

/** Spec key that holds an on/off switch position (1 = closed, 0 = open). */
export const SWITCH_SPEC = 'closed'

/**
 * Terminal groups a component bonds internally right now: its busbars, plus its switched paths
 * while they conduct. `open` lists extra node ids to treat as open (run-time faults).
 */
export function conductiveGroups(n: LabNode, open?: ReadonlySet<string>): readonly (readonly string[])[] {
  const def = BASE[n.type]
  if (!def) return []
  const conducts = n.specs[SWITCH_SPEC] !== 0 && !open?.has(n.id)
  return conducts && def.sw ? [...(def.bus ?? []), ...def.sw] : (def.bus ?? [])
}

export const CATEGORY_ORDER = [
  'Solar Generation',
  'Solar Connectors',
  'Charge Controllers',
  'Battery Systems',
  'DC Protection',
  'Inverters',
  'AC Protection',
  'Distribution Equipment',
  'Grounding and Protection',
  'Electrical Measurement',
  'Grid and Backup Integration',
  'Electrical Loads',
]

/** Sources that form (set the voltage of) an AC network. Two on one network is a fault (AC-001). */
export const AC_FORMING: readonly ComponentType[] = ['inv', 'hyb', 'grid', 'gen']

export const LOAD_TYPES: readonly ComponentType[] = ['led', 'fan', 'fridge', 'tv', 'acw', 'acs', 'pc', 'laptop', 'router', 'rice', 'kettle', 'micro', 'induc', 'wash', 'iron', 'pump']

/** PV module types (terminals p / n; `pv` is the mono module). */
export const PV_TYPES: readonly ComponentType[] = ['pv', 'pvpoly', 'pvbif', 'pvflex', 'pvport']
/** Battery types (terminals p / n); chemistry per type in battery-chem.ts. `bat` is LiFePO4. */
export const BATTERY_TYPES: readonly ComponentType[] = ['bat', 'batfla', 'batagm', 'batgel', 'batnmc']
export const isPv = (n: { type: ComponentType }) => PV_TYPES.includes(n.type)
export const isBattery = (n: { type: ComponentType }) => BATTERY_TYPES.includes(n.type)

/** Spec keys that may be negative (temperature coefficients). */
export const SIGNED_SPECS: readonly string[] = ['tcP', 'tcVoc']
/**
 * Spec keys added in rule set 1.4.0. A catalog file may omit them: installer settings take the
 * catalog default, datasheet values become 0 ("not published", which the engine does not check).
 */
export const LATE_SPECS: Readonly<Record<string, 'setting' | 'datasheet'>> = {
  tcP: 'datasheet',
  tcVoc: 'datasheet',
  noct: 'datasheet',
  bifi: 'datasheet',
  surgeP: 'datasheet',
  minDcV: 'datasheet',
  maxDcV: 'datasheet',
  tilt: 'setting',
  azimuth: 'setting',
  freq: 'setting',
  lvd: 'setting',
  lvr: 'setting',
  shedSoc: 'setting',
  surge: 'datasheet',
  priority: 'setting',
}

/** Conductor ampacity in A by cross-section (mm²). */
/** Default one-way cable run when a wire has no length, metres. */
export const DEFAULT_WIRE_LENGTH = 3
/** Copper resistivity at about 20 °C, Ω·mm²/m. */
export const COPPER_RESISTIVITY = 0.0175
/** Voltage-drop design limit used by RAT-007, percent. */
export const VOLTAGE_DROP_LIMIT = 3

export const AMPACITY: Record<string, number> = { '2.5': 24, '4': 32, '6': 41, '10': 57, '16': 76, '25': 101, '35': 125, '50': 151 }

export const DOMAIN_LABEL: Record<TerminalType, string> = {
  'dc+': 'DC +',
  'dc-': 'DC −',
  dc: 'DC',
  'ac-l': 'AC L',
  'ac-n': 'AC N',
  pe: 'Earth',
}

/** [label, simulated minutes per tick] */
export const SPEEDS: readonly (readonly [string, number])[] = [
  ['×1', 2],
  ['×4', 8],
  ['×12', 24],
]

/** Globally unique instance id, e.g. `pv-3f2a…`. Safe to mix with ids loaded from saved projects. */
export function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function makeNode(type: ComponentType, x: number, y: number, id?: string): LabNode {
  const def = CATALOG[type]
  const specs: Record<string, number> = {}
  def.specs.forEach((s) => (specs[s[0]] = s[3]))
  return { id: id ?? uid(type), type, x, y, specs, ver: def.ver }
}
