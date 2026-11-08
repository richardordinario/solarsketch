/**
 * PDF project report, generated entirely in the browser (PRD P1). Loaded on demand because
 * jsPDF is large.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { CATALOG, CATALOG_VERSION, LOAD_TYPES, isPv, RULESET_VERSION, VOLTAGE_DROP_LIMIT } from '@/engine/catalog'
import { terminalName } from '@/engine/geometry'
import { profileById } from '@/engine/profiles'
import { fixFor, ruleById } from '@/engine/rules'
import { chemistryOf } from '@/engine/battery-chem'
import { simulateDays } from '@/engine/scenario'
import { FAULT_DEFS, describeFault, type Fault } from '@/engine/faults'
import { PERFORMANCE_FACTOR, clockStr } from '@/engine/simulation'
import type { LabNode, Wire } from '@/engine/types'
import { nodeMap, validate, wireLength } from '@/engine/validation'

import { buildDiagramSvg, svgToPng } from './diagram'

/** Built-in PDF fonts use WinAnsi; map characters it lacks. */
const pdfText = (s: string) =>
  s
    .replace(/−/g, '-')
    .replace(/→/g, '->')
    .replace(/Ω/g, 'ohm')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/☀|☾/g, '')

const INK: [number, number, number] = [32, 30, 29]
const MUTED: [number, number, number] = [96, 93, 93]
const PRIMARY: [number, number, number] = [236, 48, 19]

async function blobToDataUrl(b: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

export interface ReportInput {
  projectName: string
  nodes: LabNode[]
  wires: Wire[]
  clearSky: number
  wireStyle: 'orthogonal' | 'curved'
  faults?: readonly Fault[]
}

export async function buildReportPdf({ projectName, nodes, wires, clearSky, wireStyle, faults = [] }: ReportInput): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14
  const date = new Date().toISOString().slice(0, 10)
  const v = validate(nodes, wires)
  const nm = nodeMap(nodes)

  const footer = () => {
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(pdfText('Educational simulation. A passing result does not certify an installation as safe, PEC-compliant or professionally approved.'), M, H - 7)
    doc.text(`Page ${doc.getNumberOfPages()}`, W - M, H - 7, { align: 'right' })
  }
  const header = (title: string) => {
    doc.setFillColor(...PRIMARY)
    doc.rect(M, M - 1, 3.5, 3.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text('SolarSketch', M + 6, M + 2)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(pdfText(`${projectName} · ${date} · Rules v${RULESET_VERSION} · Catalog ${CATALOG_VERSION}`), W - M, M + 2, { align: 'right' })
    doc.setDrawColor(215, 211, 211)
    doc.line(M, M + 5, W - M, M + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...INK)
    doc.text(pdfText(title), M, M + 14)
    doc.setFont('helvetica', 'normal')
  }

  // Page 1: diagram
  header(projectName)
  const diagram = buildDiagramSvg(nodes, wires, { projectName, wireStyle })
  const png = await blobToDataUrl(await svgToPng(diagram, 1.5))
  const top = M + 20
  const maxW = W - 2 * M
  const maxH = H - top - 14
  const scale = Math.min(maxW / diagram.width, maxH / diagram.height)
  doc.addImage(png, 'PNG', M + (maxW - diagram.width * scale) / 2, top, diagram.width * scale, diagram.height * scale, undefined, 'FAST')
  footer()

  const table = (title: string, head: string[], body: (string | number)[][], startY?: number) => {
    let y = startY ?? (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? M + 20
    if (y > H - 40) {
      footer()
      doc.addPage()
      header('Project report (continued)')
      y = M + 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(pdfText(title), M, y + 8)
    autoTable(doc, {
      startY: y + 11,
      head: [head.map(pdfText)],
      body: body.map((r) => r.map((c) => pdfText(String(c)))),
      margin: { left: M, right: M, bottom: 14 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: [215, 211, 211], lineWidth: 0.1 },
      headStyles: { fillColor: [234, 233, 233], textColor: INK, fontStyle: 'bold' },
      theme: 'grid',
      didDrawPage: () => footer(),
    })
  }

  // Page 2+: data
  doc.addPage()
  header('Project report')

  const pv = nodes.filter(isPv)
  const bank = v.sys.bank ?? v.sys.invBank
  const inv = nodes.find((n) => n.type === 'inv')
  const loads = nodes.filter((n) => LOAD_TYPES.includes(n.type))
  table(
    'System summary',
    ['Item', 'Value'],
    [
      ['PV array', `${pv.length} modules · ${(pv.reduce((a, p) => a + p.specs.ratedPower, 0) / 1000).toFixed(2)} kWp`],
      ['PV strings', v.sys.strings.length ? v.sys.strings.map((s) => `${s.length}S`).join(' + ') : 'None complete'],
      ['Battery bank', bank ? `${bank.strings[0].length}S${bank.strings.length}P · ${chemistryOf(bank.members[0]).label} · ${bank.nomV} V · ${bank.ah} Ah · ${bank.kwh.toFixed(2)} kWh` : 'None complete'],
      ['Inverter', inv ? `${inv.specs.ratedP} W continuous · ${inv.specs.nomV} V DC · ${inv.specs.acV} V ${inv.specs.freq || 60} Hz AC` : 'None'],
      ['Loads', `${loads.length} · ${loads.reduce((a, l) => a + l.specs.p, 0)} W combined rating`],
      ...(v.sys.ac.grids.length ? [['Utility grid', `${v.sys.ac.meters.length ? 'Net-metered' : 'No net meter'} · ${v.sys.ac.grids[0].specs.serviceA} A service`]] : []),
      ...(v.sys.ac.hyb ? [['Hybrid inverter', `${v.sys.ac.hyb.node.specs.ratedP} W · ${v.sys.ac.hyb.node.specs.nomV} V battery · export limit ${v.sys.ac.hyb.node.specs.exportLimit} W`]] : []),
      ...v.sys.ac.gtis.map((g) => ['Grid-tied inverter', `${g.node.specs.ratedP} W · MPPT ${g.node.specs.minPvV}–${g.node.specs.maxPvV} V`]),
      ...v.sys.ac.gens.map((g) => ['Generator', `${g.specs.ratedP} W · auto-start below ${g.specs.startSoc}% SOC${v.sys.ac.atss.length ? ' · via transfer switch' : ''}`]),
      ['Components / wires', `${nodes.length} / ${wires.length}`],
    ],
    M + 20,
  )

  // Bill of materials: identical type + specs collapse into one line.
  const bom = new Map<string, { n: LabNode; qty: number }>()
  for (const n of nodes) {
    const key = `${n.type}|${n.profile ?? ''}|${JSON.stringify(n.specs)}`
    const e = bom.get(key)
    if (e) e.qty++
    else bom.set(key, { n, qty: 1 })
  }
  table(
    'Bill of materials',
    ['Qty', 'Component', 'Model / profile', 'Key specifications'],
    [...bom.values()].map(({ n, qty }) => {
      const c = CATALOG[n.type]
      const p = profileById(n.profile)
      const specs = c.specs.map(([k, label, unit]) => `${label} ${n.specs[k]} ${unit}`).join('; ')
      return [qty, c.name, p ? `${p.brand} ${p.model} (${p.example ? 'example profile' : `datasheet ${p.source?.revision ?? ''}${p.reviewed ? '' : ', unreviewed'}`})` : `${c.model} · spec v${n.ver}`, specs]
    }),
  )

  table(
    'Wiring schedule',
    ['From', 'To', 'Size', 'Length', 'Current', 'Voltage drop', 'Status'],
    wires
      .filter((w) => nm[w.a.n] && nm[w.b.n])
      .map((w) => {
        const r = v.wres[w.id]
        return [
          terminalName(nm[w.a.n], w.a.t),
          terminalName(nm[w.b.n], w.b.t),
          `${w.gauge} mm²`,
          `${wireLength(w)} m`,
          r ? `${r.I.toFixed(1)} A` : '-',
          r?.drop ? `${r.drop.pct.toFixed(1)}%${r.drop.pct > VOLTAGE_DROP_LIMIT ? ' (high)' : ''}` : '-',
          r?.fail ? `${r.fail.rule}` : 'OK',
        ]
      }),
  )

  table(
    'Validation findings',
    ['Severity', 'Rule', 'Finding', 'Corrective action', 'Reference'],
    v.issues.length ? v.issues.map((i) => [i.sev, `${i.rule} ${ruleById(i.rule)?.title ?? ''}`, i.msg, fixFor(i), ruleById(i.rule)?.reference ?? '']) : [['-', '-', `No findings under rule set v${RULESET_VERSION}.`, '-', '-']],
  )

  const shown = faults.filter((f) => !f.hidden)
  if (shown.length)
    table(
      'Injected fault scenarios',
      ['Fault', 'Starts', 'Expected symptom'],
      shown.map((f) => [describeFault(f, nodes.find((n) => n.id === f.target)), f.startAt !== undefined ? clockStr(f.startAt) : 'From the start', FAULT_DEFS[f.kind].symptom]),
    )

  const run = simulateDays(nodes, wires, 3, clearSky, faults)
  table(
    `Three-day simulation at ${clearSky}% sky clearness`,
    ['Measure', 'Result'],
    [
      ['Energy generated', `${run.eGen.toFixed(2)} kWh`],
      ['Energy consumed by loads', `${run.eUse.toFixed(2)} kWh`],
      ['Battery state of charge', `start ${run.startSoc.toFixed(0)}% · minimum ${run.minSoc.toFixed(0)}% · end ${run.endSoc.toFixed(0)}%`],
      ['Inverter low-voltage shutdown', run.lvd ? 'Yes' : 'No'],
      ['Inverter overload', run.overload ? 'Yes' : 'No'],
      ['RCD trips', String(run.rcdTrips)],
      ...(v.sys.ac.grids.length ? [['Grid energy', `${run.eImport.toFixed(2)} kWh imported · ${run.eExport.toFixed(2)} kWh exported`]] : []),
      ...(v.sys.ac.gens.length ? [['Generator', `${run.fuel.toFixed(2)} L fuel · ${run.genHours.toFixed(1)} h run time (educational fuel model)`]] : []),
      ['Model', `P_PV = P_STC × (G ÷ 1000) × ${PERFORMANCE_FACTOR.toFixed(2)} × temperature factor (NOCT cell temperature, 24–32 °C ambient cycle) × fixed orientation factor (tilt/azimuth, ~12° N); clear-sky irradiance 06:00–18:00; shading only through faults; battery voltage is the chemistry's resting voltage; fixed load schedules.`],
    ],
  )

  return doc.output('blob')
}
