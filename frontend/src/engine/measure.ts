/**
 * Field measurements a technician would take with a multimeter, clamp meter or insulation tester.
 * Used for troubleshooting: they reveal faults (hidden or not) through their symptoms.
 */
import { activeFaults, faultOn, type Fault } from './faults'
import { bankOcv, cellCount, chemistryOf } from './battery-chem'
import { LOAD_TYPES, isBattery, isPv } from './catalog'
import { PRIORITY_LABEL, loadPriority, startPower, surgeFactor } from './loads'
import { cellTemp, orientationFactor, voltTempFactor } from './pv-model'
import type { Measurements, SimState } from './simulation'
import type { LabNode } from './types'
import type { ValidationResult } from './validation'

export interface Reading {
  label: string
  value: string
  /** Out-of-range reading that points at a fault. */
  abnormal?: boolean
}

const fmt = (x: number, d = 1) => x.toFixed(d)

export function measureNode(node: LabNode, sim: SimState, m: Measurements, v: ValidationResult, faults: readonly Fault[]): Reading[] {
  const act = activeFaults(faults, sim.t)
  const s = node.specs
  if (isPv(node)) {
    const failed = !!faultOn(act, node.id, 'module-open')
    const shade = faultOn(act, node.id, 'shading')?.shade ?? 0
    const g = m.G / 1000
    const tc = cellTemp(node, m.G, m.h)
    const voc = m.G > 0 && !failed ? s.voc * voltTempFactor(node, tc) * (0.9 + 0.1 * g) * (shade >= 0.95 ? 0.2 : 1) : 0
    const isc = failed ? 0 : s.isc * g * (1 - shade)
    return [
      { label: 'Open-circuit voltage', value: `${fmt(voc)} V`, abnormal: m.G > 50 && voc < s.voc * 0.5 },
      { label: 'Short-circuit current', value: `${fmt(isc, 2)} A`, abnormal: m.G > 200 && isc < s.isc * g * 0.6 },
      { label: 'Irradiance on module', value: `${fmt(m.G * (1 - shade), 0)} W/m²`, abnormal: shade > 0.2 && m.G > 50 },
      { label: 'Cell temperature', value: `${fmt(tc, 0)} °C (ambient ${fmt(m.tamb, 0)} °C)` },
      { label: 'Orientation factor', value: `${fmt(orientationFactor(node) * 100, 0)}%` },
      { label: 'Module output', value: `${fmt(m.modulePower[node.id] ?? 0, 0)} W` },
    ]
  }
  if (isBattery(node)) {
    const cut = !!faultOn(act, node.id, 'bms-cutoff')
    const chem = chemistryOf(node)
    const cells = cellCount(chem, s.nomV)
    const inBank = !!(v.sys.bank ?? v.sys.invBank)?.members.some((b) => b.id === node.id)
    // A member's share of the bank voltage; a battery outside any bank reads its own resting voltage.
    const vNode = cut ? 0 : inBank && m.vnom ? (m.vbat * s.nomV) / m.vnom : bankOcv(chem, s.nomV, sim.soc)
    const bms = !chem.bms ? 'None (lead-acid)' : cut ? 'Cut-off (output disconnected)' : sim.bmsLow ? 'Low-voltage cut-off (discharge off)' : m.ac.bmsOvercurrent ? 'Over-current trip' : 'Normal'
    return [
      { label: 'Terminal voltage', value: `${fmt(vNode)} V`, abnormal: cut },
      { label: 'BMS status', value: bms, abnormal: cut || !!sim.bmsLow || m.ac.bmsOvercurrent },
      { label: 'State of charge', value: `${fmt(sim.soc, 0)}%`, abnormal: sim.soc < chem.minSoc },
      { label: 'Chemistry', value: chem.label },
      { label: 'Recommended minimum SOC', value: `${chem.minSoc}%` },
      { label: 'Charge voltage (absorption / float)', value: `${fmt(cells * chem.absorbV)} V / ${chem.floatV ? `${fmt(cells * chem.floatV)} V` : 'none'}` },
    ]
  }
  switch (node.type) {
    case 'dcb': {
      const tripped = !!faultOn(act, node.id, 'breaker-trip')
      return [
        { label: 'Breaker position', value: tripped ? 'Tripped (open)' : 'Closed', abnormal: tripped },
        { label: 'Voltage LINE → LOAD', value: tripped ? `${fmt(m.vbat)} V across open contacts` : '0.0 V', abnormal: tripped },
      ]
    }
    case 'inv': {
      const hot = !!faultOn(act, node.id, 'inverter-overtemp')
      return [
        { label: 'DC input', value: m.dcOff ? '0.0 V' : `${fmt(m.vbat)} V`, abnormal: m.dcOff },
        { label: 'AC output', value: m.invOn ? `${s.acV} V · ${fmt(m.pload, 0)} W` : 'Off', abnormal: !m.invOn && v.sys.invOk },
        { label: 'AC frequency', value: m.invOn ? `${s.freq || 60} Hz` : '0 Hz' },
        { label: 'Heatsink', value: hot ? 'Over-temperature, derated to 50%' : m.thermalTrip ? 'Thermal trip, cooling down' : m.ac.invStrained ? 'Overloaded, heating up' : 'Normal', abnormal: hot || m.thermalTrip || m.ac.invStrained },
        { label: 'Low-voltage disconnect', value: s.lvd ? `${s.lvd} V (reconnect ${s.lvr || s.lvd} V)${sim.lvd ? ' · tripped' : ''}` : 'Not set', abnormal: !!sim.lvd },
        { label: 'Loads shed', value: m.ac.shed.length ? String(m.ac.shed.length) : 'None', abnormal: m.ac.shed.length > 0 },
      ]
    }
    case 'acdb': {
      const tripped = (sim.rcdTripped ?? []).includes(node.id)
      return [
        { label: 'RCD', value: tripped ? 'Tripped' : 'Closed', abnormal: tripped },
        { label: 'Busbar voltage', value: m.invOn && !tripped ? `${v.sys.inv?.specs.acV ?? 230} V` : '0 V', abnormal: tripped },
      ]
    }
    case 'outlet': {
      // A plug-in socket tester and a clamp meter on the outlet feed.
      const live = m.ac.outletsLive.includes(node.id)
      const earthed = !v.issues.some((i) => i.rule === 'GND-003' && i.target.node === node.id)
      const amps = m.onLoads.filter((l) => v.sys.outletsOf[l.id]?.includes(node.id)).reduce((a, l) => a + l.specs.p, 0) / 230
      return [
        { label: 'Socket voltage', value: live ? `${v.sys.inv?.specs.acV ?? 230} V` : '0 V', abnormal: !live && v.sys.outletsSupplied.includes(node.id) },
        { label: 'Load current', value: `${fmt(amps, 2)} A`, abnormal: amps > s.ratedI },
        { label: 'Earth (PE)', value: earthed ? 'Connected' : 'Missing', abnormal: !earthed },
      ]
    }
    case 'mppt':
    case 'pwm':
      return [
        { label: 'PV input', value: `${fmt(m.vpv)} V · ${fmt(m.ipv, 2)} A` },
        { label: 'Charge output', value: `${fmt(m.cc, 0)} W` },
      ]
    case 'grid': {
      const out = !!faultOn(act, node.id, 'grid-outage')
      return [
        { label: 'Supply voltage', value: out ? '0 V (outage)' : `${s.acV} V · 60 Hz`, abnormal: out },
        { label: 'Power flow', value: m.ac.pgrid >= 0 ? `${fmt(m.ac.pgrid, 0)} W import` : `${fmt(-m.ac.pgrid, 0)} W export` },
      ]
    }
    case 'nm':
      return [
        { label: 'Imported (total)', value: `${fmt(sim.eImport ?? 0, 2)} kWh` },
        { label: 'Exported (total)', value: `${fmt(sim.eExport ?? 0, 2)} kWh` },
      ]
    case 'gen': {
      const fail = !!faultOn(act, node.id, 'gen-fail')
      const running = (sim.genOn ?? []).includes(node.id) && !fail
      const called = (sim.genOn ?? []).includes(node.id)
      return [
        { label: 'Status', value: running ? `Running · ${fmt(m.ac.pgen, 0)} W` : called && fail ? 'Failed to start' : 'Standby', abnormal: called && fail },
        { label: 'Fuel used', value: `${fmt(sim.fuel ?? 0, 2)} L` },
        { label: 'Run time', value: `${fmt(sim.genHours ?? 0, 1)} h` },
      ]
    }
    case 'ats':
      return [{ label: 'Position', value: { main: 'Main', backup: 'Backup', none: 'Open (no live source)' }[m.ac.atsSide[node.id] ?? 'none'], abnormal: (m.ac.atsSide[node.id] ?? 'none') === 'none' }]
    case 'gti':
      return [
        { label: 'PV input', value: `${fmt(m.vpv)} V` },
        { label: 'AC output', value: m.ac.gtiIslanded ? '0 W (no grid, anti-islanding)' : `${fmt(m.ac.gtiAc, 0)} W`, abnormal: m.ac.gtiIslanded },
      ]
    case 'hyb':
      return [
        { label: 'Mode', value: { off: 'Off', none: 'Off', grid: 'Grid-assisted', battery: 'Battery / solar', generator: 'Generator-assisted' }[m.ac.hybMode] },
        { label: 'PV to AC', value: `${fmt(m.ac.hybPv, 0)} W` },
        { label: 'Battery', value: `${m.ac.hybBattery >= 0 ? '+' : ''}${fmt(m.ac.hybBattery, 0)} W · ${fmt(sim.soc, 0)}%` },
        { label: 'AC frequency', value: m.freq ? `${fmt(m.freq, 0)} Hz` : '0 Hz' },
      ]
    case 'mi': {
      const share = v.sys.ac.gtis.length ? m.ac.gtiAc / v.sys.ac.gtis.length : 0
      return [
        { label: 'PV input', value: `${fmt(m.vpv)} V` },
        { label: 'AC output', value: m.ac.gtiIslanded ? '0 W (no grid, anti-islanding)' : `${fmt(share, 0)} W`, abnormal: m.ac.gtiIslanded },
      ]
    }
    case 'fuse': {
      const blown = !!faultOn(act, node.id, 'fuse-blown')
      return [
        { label: 'Fuse', value: blown ? 'Blown (open)' : 'Intact', abnormal: blown },
        { label: 'Continuity', value: blown ? 'Open circuit' : '< 0.1 Ω', abnormal: blown },
        { label: 'Voltage LINE → LOAD', value: blown ? `${fmt(m.vbat)} V across the open fuse` : '0.0 V', abnormal: blown },
      ]
    }
    case 'iso':
    case 'acsw':
    case 'mcb':
    case 'mccb':
    case 'rccb': {
      const tripped = !!faultOn(act, node.id, 'ac-breaker-trip') || (node.type === 'rccb' && (sim.rcdTripped ?? []).includes(node.id))
      const open = s.closed === 0
      const dc = node.type === 'iso'
      const supply = dc ? (m.vbat > 0 ? `${fmt(m.vbat)} V DC` : '0 V') : m.ac.liveDevices.includes(node.id) ? `${v.sys.inv?.specs.acV ?? 230} V` : '0 V'
      return [
        { label: 'Position', value: tripped ? 'Tripped (open)' : open ? 'Open' : 'Closed', abnormal: tripped },
        { label: 'Supply side', value: supply },
        { label: 'Load side', value: tripped || open ? '0 V' : supply, abnormal: tripped },
      ]
    }
    case 'dspd':
    case 'aspd': {
      const earthed = !v.issues.some((i) => i.rule === 'GND-010' && i.target.node === node.id)
      return [
        { label: 'Status window', value: 'Green (healthy)' },
        { label: 'Earth (PE)', value: earthed ? 'Connected' : 'Missing', abnormal: !earthed },
      ]
    }
    case 'cbx':
      return [
        { label: 'Output voltage', value: `${fmt(m.vpv)} V` },
        { label: 'String fuses', value: `${s.fuseA} A · intact` },
      ]
    case 'mc4':
    case 'ybr':
      return [{ label: 'Continuity', value: '< 0.1 Ω' }]
    case 'dbus':
      return [{ label: 'Busbar voltage', value: `${fmt(m.vbat)} V` }]
    case 'pebar': {
      const count = v.wires.filter((w) => w.a.n === node.id || w.b.n === node.id).length
      return [{ label: 'Bonded conductors', value: String(count) }]
    }
    case 'dcm':
    case 'acm': {
      const r = m.meters[node.id] ?? { v: 0, a: 0, w: 0 }
      const wh = sim.meterWh?.[node.id] ?? 0
      const noSense = node.type === 'dcm' && !v.wires.some((w) => (w.a.n === node.id && w.a.t === 'vp') || (w.b.n === node.id && w.b.t === 'vp'))
      return [
        { label: 'Voltage', value: noSense ? '— (V+ sense not connected)' : `${fmt(r.v)} V`, abnormal: noSense },
        { label: 'Current', value: `${fmt(r.a, 2)} A`, abnormal: Math.abs(r.a) > s.ratedI },
        { label: 'Power', value: `${fmt(r.w, 0)} W` },
        { label: 'Energy', value: node.type === 'dcm' ? `${fmt(wh, 0)} Wh` : `${fmt(wh / 1000, 2)} kWh` },
      ]
    }
    case 'ctm': {
      const r = m.meters[node.id] ?? { v: 0, a: 0, w: 0 }
      const exp = sim.meterExportWh?.[node.id] ?? 0
      const imp = (sim.meterWh?.[node.id] ?? 0) + exp
      return [
        { label: 'Voltage', value: `${fmt(r.v)} V` },
        { label: 'CT current', value: `${fmt(Math.abs(r.a), 2)} A`, abnormal: Math.abs(r.a) > s.ratedI },
        { label: 'Grid power', value: r.w > 1 ? `${fmt(r.w, 0)} W import` : r.w < -1 ? `${fmt(-r.w, 0)} W export` : '0 W' },
        { label: 'Export limit', value: s.exportLimit > 0 ? `${s.exportLimit} W` : '0 W (zero export)' },
        { label: 'Curtailed by export limit', value: `${fmt(m.ac.ctmCurtailed ?? 0, 0)} W`, abnormal: (m.ac.ctmCurtailed ?? 0) > 1 },
        { label: 'Energy imported', value: `${fmt(imp / 1000, 2)} kWh` },
        { label: 'Energy exported', value: `${fmt(exp / 1000, 2)} kWh` },
      ]
    }
    case 'gnd':
      return [{ label: 'Earth resistance', value: `${s.res} Ω` }]
    default: {
      // Loads: an insulation-resistance test reveals earth leakage (only once the fault exists).
      const leak = !!faultOn(act, node.id, 'ground-fault')
      const on = m.onLoads.some((l) => l.id === node.id)
      const readings: Reading[] = [
        { label: 'Supply', value: on ? `${v.sys.inv?.specs.acV ?? 230} V` : '0 V' },
        { label: 'Insulation resistance (L+N to PE)', value: leak ? '0.04 MΩ (fail)' : '> 100 MΩ (pass)', abnormal: leak },
      ]
      if (!LOAD_TYPES.includes(node.type)) return readings
      const shed = m.ac.shed.find((x) => x.id === node.id)
      const blocked = m.ac.blocked.some((l) => l.id === node.id)
      return readings.concat([
        { label: 'Status', value: on ? 'Running' : shed ? (shed.reason === 'battery' ? 'Shed (battery low)' : 'Shed (inverter at its limit)') : blocked ? 'Could not start (surge overload)' : 'Off', abnormal: !!shed || blocked },
        { label: 'Priority', value: `${loadPriority(node)} · ${PRIORITY_LABEL[loadPriority(node)]}` },
        { label: 'Startup surge', value: `${fmt(startPower(node), 0)} W (${surgeFactor(node)}×)` },
        { label: 'Energy used', value: `${fmt(sim.loadKwh?.[node.id] ?? 0, 2)} kWh` },
      ])
    }
  }
}
