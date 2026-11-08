import { lazy, Suspense, useEffect } from 'react'

import { Canvas } from '@/components/lab/canvas'

// Three.js is large: load the 3D lab only when it is opened.
const Lab3D = lazy(() => import('@/components/lab3d/lab-3d'))
import { ConfirmDialog } from '@/components/lab/confirm-dialog'
import { ConsolePanel } from '@/components/lab/console-panel'
import { InspectorPanel } from '@/components/lab/inspector-panel'
import { LabHeader } from '@/components/lab/lab-header'
import { LibraryPanel } from '@/components/lab/library-panel'
import { DRAWER_W, RAIL_W } from '@/components/lab/drawers'
import { DrawerSlot } from '@/components/lab/shared'
import { StatusBar } from '@/components/lab/status-bar'
import { Toolbar } from '@/components/lab/toolbar'
import { StepsPanel, TaskBar } from '@/components/lab/task-bar'
import { taskById } from '@/content/tasks'
import { useLabRuntime } from '@/hooks/use-lab-runtime'
import { useLabStore } from '@/store/lab-store'
import { t } from '@/i18n'

const col = (open: boolean, width: number) => `${open ? width : RAIL_W}px`

export function VirtualLabPage() {
  useLabRuntime()
  // Pause the simulation when leaving the lab; the clock only ticks here.
  useEffect(() => () => useLabStore.setState({ running: false }), [])
  const consoleOpen = useLabStore((s) => s.consoleOpen)
  const viewMode = useLabStore((s) => s.viewMode)
  const libraryOpen = useLabStore((s) => s.libraryOpen)
  const inspectorOpen = useLabStore((s) => s.inspectorOpen)
  const stepsOpen = useLabStore((s) => s.stepsOpen)
  const hasTask = useLabStore((s) => !!s.task && !!taskById(s.task.id))
  // Steps and Details both collapsed: the Steps column closes to 0 and its rail joins the Details rail.
  const railsMerged = hasTask && !stepsOpen && !inspectorOpen
  const stepsCol = railsMerged ? '0px' : col(stepsOpen, DRAWER_W.steps)

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)_26px] overflow-hidden select-none">
      <LabHeader />
      <Toolbar />
      {/* Wrapper keeps the grid rows stable when there is no task. */}
      <div>
        <TaskBar />
      </div>
      {/* Drawer columns and the console row animate their size (CSS grid track interpolation). */}
      <div
        className="grid min-h-0 ease-out motion-safe:transition-[grid-template-columns] motion-safe:duration-200"
        style={{ gridTemplateColumns: `${col(libraryOpen, DRAWER_W.library)} minmax(0,1fr)${hasTask ? ' ' + stepsCol : ''} ${col(inspectorOpen, DRAWER_W.inspector)}` }}
      >
        <DrawerSlot side="left">
          <LibraryPanel />
        </DrawerSlot>
        <main
          className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200"
          style={{ gridTemplateRows: `minmax(0,1fr) ${consoleOpen ? 'min(264px, 40%)' : '38px'}` }}
        >
          {viewMode === '3d' ? (
            <Suspense fallback={<div className="flex items-center justify-center bg-canvas text-muted-foreground">{t('Loading the 3D laboratory…')}</div>}>
              <Lab3D />
            </Suspense>
          ) : (
            <Canvas />
          )}
          <ConsolePanel />
        </main>
        {hasTask && (
          <DrawerSlot side="right" hidden={railsMerged}>
            <StepsPanel />
          </DrawerSlot>
        )}
        <DrawerSlot side="right">
          <InspectorPanel />
        </DrawerSlot>
      </div>
      <StatusBar />
      <ConfirmDialog />
    </div>
  )
}
