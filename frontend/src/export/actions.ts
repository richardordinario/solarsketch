import { toast } from 'sonner'

import { downloadBlob, downloadProject } from '@/storage/repository'
import { useLabStore } from '@/store/lab-store'

import { buildDiagramSvg, svgToPng } from './diagram'
import { t } from '@/i18n'

function baseName() {
  const name = useLabStore.getState().projectName
  return (
    name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'project'
  )
}

export async function exportDiagram(format: 'png' | 'svg') {
  const s = useLabStore.getState()
  const d = buildDiagramSvg(s.nodes, s.wires, { projectName: s.projectName, wireStyle: s.settings.wireStyle })
  try {
    const blob = format === 'svg' ? new Blob([d.svg], { type: 'image/svg+xml' }) : await svgToPng(d, 2)
    downloadBlob(blob, `${baseName()}-diagram.${format}`)
  } catch {
    toast.error(t('The diagram could not be exported.'))
  }
}

export async function exportReport() {
  const s = useLabStore.getState()
  const id = toast.loading('Building the PDF report…')
  try {
    // jsPDF is large; load it only when a report is requested.
    const { buildReportPdf } = await import('./report')
    const blob = await buildReportPdf({ projectName: s.projectName, nodes: s.nodes, wires: s.wires, clearSky: s.clear, wireStyle: s.settings.wireStyle, faults: s.faults })
    downloadBlob(blob, `${baseName()}-report.pdf`)
    toast.success(t('PDF report downloaded.'), { id })
  } catch {
    toast.error(t('The PDF report could not be created.'), { id })
  }
}

export function exportProjectFile() {
  const doc = useLabStore.getState().toDocument()
  if (doc) downloadProject(doc)
}
