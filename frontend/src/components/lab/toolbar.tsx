import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SPEEDS } from '@/engine/catalog'
import { exportDiagram, exportProjectFile, exportReport } from '@/export/actions'
import { cn } from '@/lib/utils'
import { SIM_STEPS, useLabStore, useValidation } from '@/store/lab-store'

import { DeleteIcon, DuplicateIcon, FitIcon, PanIcon, PauseIcon, PlayIcon, RedoIcon, ResetIcon, RotateIcon, SelectIcon, StopIcon, UndoIcon, WireIcon, ZoomInIcon, ZoomOutIcon } from './icons'
import { SevIcon } from './sev-icon'
import { ToolButton, ToolDivider } from './shared'
import { t } from '@/i18n'

const segment = 'h-full rounded-none border-0 px-[9px] font-semibold text-[13px] tabular-nums text-dim hover:bg-muted hover:text-foreground data-[pressed]:bg-secondary data-[pressed]:text-active-fg aria-pressed:bg-secondary aria-pressed:text-active-fg'

export function Toolbar() {
  const tool = useLabStore((s) => s.tool)
  const setTool = useLabStore((s) => s.setTool)
  const canUndo = useLabStore((s) => s.hist.length > 0)
  const canRedo = useLabStore((s) => s.fut.length > 0)
  const zoom = useLabStore((s) => s.view.z)
  const running = useLabStore((s) => s.running)
  const started = useLabStore((s) => s.sim.started)
  const stopped = useLabStore((s) => s.stopped)
  const simStep = useLabStore((s) => s.settings.simStep)
  const speed = useLabStore((s) => s.speed)
  const viewMode = useLabStore((s) => s.viewMode)
  const a = useLabStore.getState()
  const { issues } = useValidation()

  const counts = { critical: 0, warning: 0, info: 0 }
  issues.forEach((i) => counts[i.sev]++)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 edge-b px-2 py-1.5 whitespace-nowrap">
      <ToolButton label={t('Select (V)')} active={tool === 'select'} onClick={() => setTool('select')}>
        <SelectIcon />
      </ToolButton>
      <ToolButton label={t('Wire (W)')} active={tool === 'wire'} onClick={() => setTool('wire')}>
        <WireIcon />
      </ToolButton>
      <ToolButton label={t('Pan (H)')} active={tool === 'pan'} onClick={() => setTool('pan')}>
        <PanIcon />
      </ToolButton>
      <ToolDivider />
      <ToolButton label={t('Undo (Ctrl+Z)')} disabled={!canUndo} onClick={a.undo}>
        <UndoIcon />
      </ToolButton>
      <ToolButton label={t('Redo (Ctrl+Shift+Z)')} disabled={!canRedo} onClick={a.redo}>
        <RedoIcon />
      </ToolButton>
      <ToolDivider />
      <ToolButton label={t('Duplicate (Ctrl+D)')} onClick={a.duplicate}>
        <DuplicateIcon />
      </ToolButton>
      <ToolButton label={t('Rotate 90° (R)')} onClick={a.rotate}>
        <RotateIcon />
      </ToolButton>
      <ToolButton label={t('Delete (Del)')} onClick={a.del}>
        <DeleteIcon />
      </ToolButton>
      <ToolDivider />
      <ToolButton label={t('Zoom out (−)')} onClick={() => a.zoomAt(1 / 1.2)}>
        <ZoomOutIcon />
      </ToolButton>
      <div className="w-12 text-center font-semibold tabular-nums">{Math.round(zoom * 100)}%</div>
      <ToolButton label={t('Zoom in (+)')} onClick={() => a.zoomAt(1.2)}>
        <ZoomInIcon />
      </ToolButton>
      <ToolButton label={t('Fit to view (F)')} onClick={a.fit}>
        <FitIcon />
      </ToolButton>

      <div className="min-w-0 flex-1 basis-0" />

      <div className="flex h-[30px] edge" role="radiogroup" aria-label={t('View')}>
        {(['2d', '3d'] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={viewMode === m}
            onClick={() => a.setViewMode(m)}
            title={m === '3d' ? t('3D virtual laboratory (inspection; wiring is edited in 2D)') : t('2D wiring sheet')}
            className={cn('flex cursor-pointer items-center border-0 px-3 font-semibold', viewMode === m ? 'bg-secondary text-secondary-foreground' : 'bg-transparent text-dim hover:bg-muted')}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <ToolDivider />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-[30px] border-(length:--bw) border-border bg-transparent px-3 text-[13px] font-semibold hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted"
            />
          }
        >
          {t('Export')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-none ring-border">
          <DropdownMenuItem className="text-[13px]" onClick={() => void exportDiagram('png')}>
            {t('Wiring diagram (PNG)')}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-[13px]" onClick={() => void exportDiagram('svg')}>
            {t('Wiring diagram (SVG)')}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-[13px]" onClick={() => void exportReport()}>
            {t('Project report (PDF)')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-[13px]" onClick={exportProjectFile}>
            {t('Project file (.solarsketch.json)')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        onClick={() => a.setTab('val')}
        className="h-[30px] gap-2.5 border-(length:--bw) border-border bg-transparent px-3 text-[13px] font-semibold hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted"
      >
        <span>{t('Validate')}</span>
        <span className="flex items-center gap-1 text-critical tabular-nums" title={t('Critical')}>
          <SevIcon sev="critical" /> {counts.critical}
        </span>
        <span className="flex items-center gap-1 text-warning tabular-nums" title={t('Warning')}>
          <SevIcon sev="warning" /> {counts.warning}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground tabular-nums" title={t('Info')}>
          <SevIcon sev="info" /> {counts.info}
        </span>
      </Button>
      <Button
        onClick={a.runToggle}
        className="h-[30px] min-w-[150px] justify-between gap-3 border-2 border-primary bg-primary px-3 text-[13px] font-strong text-white hover:border-primary-hover hover:bg-primary-hover active:translate-y-0"
      >
        <span>{running ? t('Pause') : started && !stopped ? t('Resume') : stopped ? t('Start new run') : t('Run simulation')}</span>
        {running ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              aria-label={t('Stop')}
              disabled={!started || stopped}
              onClick={a.stop}
              className="size-[30px] border-(length:--bw) border-border bg-transparent p-0 hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted"
            />
          }
        >
          <StopIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('Stop: end the run and keep its readings')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              aria-label={t('Reset')}
              disabled={!started}
              onClick={a.reset}
              className="size-[30px] border-(length:--bw) border-border bg-transparent p-0 hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted"
            />
          }
        >
          <ResetIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('Reset: clear time, energy totals and the event log')}</TooltipContent>
      </Tooltip>

      <Select
        items={SIM_STEPS.map((m) => ({ value: String(m), label: t('{m} min/step', { m }) }))}
        value={String(simStep)}
        onValueChange={(v) => v != null && a.setSettings({ simStep: Number(v) as (typeof SIM_STEPS)[number] })}
      >
        <SelectTrigger
          aria-label={t('Simulation time step')}
          title={t('Simulated minutes per step at ×1 (the speed multiplies it)')}
          className="h-[30px] border-(length:--bw) border-border bg-transparent px-2 text-[13px] font-semibold tabular-nums focus-visible:ring-0 data-[size=default]:h-[30px] dark:bg-transparent dark:hover:bg-muted"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="ring-border">
          {SIM_STEPS.map((m) => (
            <SelectItem key={m} value={String(m)} className="text-[13px]">
              {t('{m} min/step', { m })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToggleGroup
        aria-label={t('Simulation speed')}
        spacing={0}
        value={[String(speed)]}
        onValueChange={(v) => v.length && a.setSpeed(Number(v[0]))}
        className="h-[30px] gap-0 edge"
      >
        {SPEEDS.map(([label], i) => (
          <ToggleGroupItem key={label} value={String(i)} className={cn(segment)}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
