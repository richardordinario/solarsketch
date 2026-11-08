import { toast } from 'sonner'
import { create } from 'zustand'

import { DEFAULT_WIRE_FILTER, type WireFilter } from '@/engine/wire-filter'
import { CATALOG_VERSION, RULESET_VERSION, SPEEDS, makeNode, uid } from '@/engine/catalog'
import { keepCentre, nextRotation, nodeSize, terminal, terminalName, terminalPos } from '@/engine/geometry'
import { clockStr, freshSim, step, type LogEntry, type SimState } from '@/engine/simulation'
import type { ComponentType, LabNode, Severity, TermRef, Wire } from '@/engine/types'
import { FAULT_DEFS, activeFaults, pruneFaults, type Fault } from '@/engine/faults'
import type { Environment3D } from '@/engine/layout3d'
import { makeDeviceNode, matchesProfile, nodeTitle, profileById, profileSpecs } from '@/engine/profiles'
import { checkWire, nodeMap, validateCached } from '@/engine/validation'
import { getMeta, getSettings, isStorageAvailable, saveProject, setLastProjectId, setMeta, updateSettings } from '@/storage/repository'
import { STORAGE_SCHEMA_VERSION, type ProjectDocument, type Settings, type TaskRef } from '@/storage/schema'
import { t } from '@/i18n'

import { reportWriteError } from './storage-toast'

export type Tool = 'select' | 'wire' | 'pan'
export type ConsoleTab = 'meas' | 'val' | 'faults' | 'log'

export interface Selection {
  nodes: string[]
  wire: string | null
}

export interface View {
  x: number
  y: number
  z: number
}

interface Snapshot {
  nodes: LabNode[]
  wires: Wire[]
}

export type CanvasSettings = Omit<Settings, 'theme' | 'libraryOpen' | 'inspectorOpen' | 'stepsOpen' | 'lang'>

/** Box-select rectangle in world coordinates. */
export interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Allowed simulation time steps, minutes per tick at ×1 (PRD §14). */
export const SIM_STEPS = [1, 2, 5, 10, 15] as const

/** Simulated minutes per tick for a time step and speed index (×1, ×4, ×12 multiply the step). */
export function tickMinutes(simStep: number, speedIdx: number) {
  const mult = (SPEEDS[speedIdx]?.[1] ?? SPEEDS[0][1]) / SPEEDS[0][1]
  return simStep * mult
}

/** Keyboard nudge distance on the sheet, px (Shift = large step). */
const NUDGE = 10
const NUDGE_LARGE = 50

interface LabState {
  /** Null until a project is loaded at boot. */
  projectId: string | null
  projectName: string
  createdAt: string
  /** Lesson practice or challenge attached to the open project. */
  task: TaskRef | null
  /** Injected fault scenarios (P2); part of the project. */
  faults: Fault[]
  nodes: LabNode[]
  wires: Wire[]
  sel: Selection
  tool: Tool
  view: View
  pending: TermRef | null
  mouse: { x: number; y: number }
  hist: string[]
  fut: string[]
  query: string
  saved: boolean
  savedAt: number
  tab: ConsoleTab
  consoleOpen: boolean
  libraryOpen: boolean
  inspectorOpen: boolean
  /** Task steps drawer, shown only while a practice or challenge is open. */
  stepsOpen: boolean
  legendOpen: boolean
  /** Which wires the 2D sheet draws (display only, not saved). */
  wireFilter: WireFilter
  sim: SimState
  running: boolean
  /** Stop was pressed: the run is over but its readings stay until Reset or the next Start. */
  stopped: boolean
  /** Box-select rectangle while dragging on empty canvas with the select tool. */
  marquee: Marquee | null
  /** Node whose terminal picker is open (keyboard wiring). */
  termPicker: string | null
  speed: number
  clear: number
  log: LogEntry[]
  settings: CanvasSettings
  /** 2D sheet or 3D lab view of the same project. */
  viewMode: '2d' | '3d'
  env3d: Environment3D
}

interface LabActions {
  setViewportEl: (el: HTMLDivElement | null) => void
  setTool: (tool: Tool) => void
  setQuery: (q: string) => void
  setTab: (tab: ConsoleTab) => void
  toggleConsole: () => void
  toggleLibrary: () => void
  toggleInspector: () => void
  toggleSteps: () => void
  toggleLegend: () => void
  setWireFilter: (patch: Partial<WireFilter>) => void
  setClear: (v: number) => void
  setSpeed: (i: number) => void
  setViewMode: (mode: '2d' | '3d') => void
  setEnv3d: (env: Environment3D) => void
  /** Move the simulation clock forward to the next occurrence of an hour (energy totals unchanged). */
  jumpToHour: (hour: number) => void
  select: (sel: Selection) => void
  clearSelection: () => void

  undo: () => void
  redo: () => void
  del: () => void
  /** Rotate the selected components 90° clockwise. */
  rotate: () => void
  /** Move the selected components by a keyboard nudge. */
  nudge: (dx: number, dy: number, large?: boolean) => void
  /** Open (or close with null) the keyboard terminal picker for a component. */
  openTermPicker: (nodeId: string | null) => void
  /** Wire from or to a terminal: the first pick starts a wire, the second on another terminal connects. */
  pickTerminal: (n: string, t: string) => void
  /** Space held: drag pans with the select tool. */
  setPanKey: (held: boolean) => void
  duplicate: () => void
  copy: () => void
  paste: () => void
  /** Manual save (Ctrl+S / Save button): persists and logs. */
  save: () => void
  /** Persist without logging. Used by autosave. Returns false if the write failed. */
  persist: (opts?: { manual?: boolean }) => Promise<boolean>
  toDocument: () => ProjectDocument | null
  loadDocument: (doc: ProjectDocument) => void
  renameProject: (name: string) => void
  /** Detach the lesson practice or challenge from the open project. */
  clearTask: () => void
  addFault: (f: Omit<Fault, 'id'>) => void
  removeFault: (id: string) => void
  /** Technician repair: clears every active fault on a component. */
  repairNode: (nodeId: string) => void
  resetRcd: (boardId: string) => void
  setSettings: (patch: Partial<CanvasSettings>) => void
  addLog: (sev: Severity, text: string) => void

  /** Add a component; with `profileId`, a real device carrying that profile's specs. */
  addAtCenter: (type: ComponentType, profileId?: string) => void
  dropAt: (type: ComponentType, clientX: number, clientY: number, profileId?: string) => void
  updateSpec: (nodeId: string, key: string, value: number) => void
  /** Apply an equipment profile's specs to a component. */
  applyProfile: (nodeId: string, profileId: string) => void
  updateWire: (wireId: string, patch: Partial<Pick<Wire, 'gauge' | 'color' | 'length'>>) => void

  zoomAt: (factor: number, cx?: number, cy?: number) => void
  fit: () => void

  viewportDown: (e: React.MouseEvent | MouseEvent) => void
  nodeDown: (id: string, e: React.MouseEvent) => void
  termDown: (n: string, t: string, e: React.MouseEvent) => void
  termUp: (n: string, t: string, e: React.MouseEvent) => void
  pointerMove: (e: MouseEvent) => void
  pointerUp: () => void

  /** Start, pause or resume. Starting after Stop begins a new run from the start of the day. */
  runToggle: () => void
  /** Halt the run and keep its readings. */
  stop: () => void
  /** Clear time, energy totals and the event log back to the start of the day. */
  reset: () => void
  tick: () => void
}

type Drag =
  | { mode: 'pan'; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { mode: 'node'; sx: number; sy: number; orig: Record<string, { x: number; y: number }>; moved: boolean }
  | { mode: 'wire'; sx: number; sy: number; moved: boolean }
  | { mode: 'box'; sx: number; sy: number; wx: number; wy: number; base: string[]; moved: boolean }

// Interaction state that must not trigger renders.
let viewportEl: HTMLDivElement | null = null
let drag: Drag | null = null
let clip: Snapshot | null = null
let lastMouseUpdate = 0
let panKey = false

const EMPTY_SEL: Selection = { nodes: [], wire: null }
/** updatedAt of the last document this tab wrote, per project. Used to detect edits from other tabs. */
export const lastWritten = new Map<string, string>()
const MAX_HISTORY = 80
const MAX_LOG = 200

/** Save drawer collapse state (a per-browser preference in `solarsketch:settings`). */
function saveDrawers(patch: Partial<Pick<Settings, 'inspectorOpen' | 'stepsOpen'>>) {
  try {
    updateSettings(patch)
  } catch {
    // Storage full or unavailable: keep the in-session value.
  }
}

export const useLabStore = create<LabState & LabActions>()((set, get) => {
  /** Clicking one component or a wire opens the Details drawer if it is collapsed (closing Steps during a task). */
  const revealDetails = (sel: Selection) => {
    if ((sel.nodes.length === 1 || sel.wire) && !get().inspectorOpen) get().toggleInspector()
  }
  const snap = (v: number) => (get().settings.snapToGrid ? Math.round(v / 10) * 10 : v)

  const toWorld = (cx: number, cy: number) => {
    const r = viewportEl!.getBoundingClientRect()
    const v = get().view
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }
  }

  const pushHist = () =>
    set((s) => ({ hist: s.hist.concat([JSON.stringify({ nodes: s.nodes, wires: s.wires })]).slice(-MAX_HISTORY), fut: [], saved: false }))

  const addLog = (sev: Severity, text: string) =>
    set((s) => ({ log: [{ time: clockStr(s.sim.t), sev, text }].concat(s.log).slice(0, MAX_LOG) }))

  const copySel = (): Snapshot | null => {
    const { sel, nodes, wires } = get()
    const ids = sel.nodes
    if (!ids.length) return null
    return { nodes: nodes.filter((n) => ids.includes(n.id)), wires: wires.filter((w) => ids.includes(w.a.n) && ids.includes(w.b.n)) }
  }

  const pasteClip = (c: Snapshot | null) => {
    if (!c) return
    pushHist()
    const map: Record<string, string> = {}
    const nn = c.nodes.map((n) => {
      const id = uid(n.type)
      map[n.id] = id
      return { ...n, id, x: n.x + 40, y: n.y + 40, specs: { ...n.specs } }
    })
    const nw = c.wires.map((w) => ({ ...w, id: uid('w'), a: { n: map[w.a.n], t: w.a.t }, b: { n: map[w.b.n], t: w.b.t } }))
    set((s) => ({ nodes: s.nodes.concat(nn), wires: s.wires.concat(nw), sel: { nodes: nn.map((n) => n.id), wire: null } }))
    clip = { nodes: nn, wires: nw }
  }

  const connect = (a: TermRef, b: TermRef) => {
    const { wires, nodes } = get()
    const dup = wires.some(
      (w) => (w.a.n === a.n && w.a.t === a.t && w.b.n === b.n && w.b.t === b.t) || (w.a.n === b.n && w.a.t === b.t && w.b.n === a.n && w.b.t === a.t),
    )
    if (dup) {
      set({ pending: null })
      return
    }
    const nm = nodeMap(nodes)
    const ta = terminal(nm[a.n], a.t)!
    const w: Wire = { id: uid('w'), a, b, color: 'auto', gauge: ta.t === 'ac-l' || ta.t === 'ac-n' ? '2.5' : '6' }
    const r = checkWire(w, nm)
    pushHist()
    set((s) => ({ wires: s.wires.concat([w]), pending: null, sel: { nodes: [], wire: w.id } }))
    if (r?.fail) addLog(r.fail.sev, `${r.fail.rule}: ${r.fail.msg}`)
    else addLog('info', `Connected ${terminalName(nm[a.n], a.t)} to ${terminalName(nm[b.n], b.t)}.`)
  }

  /** Click/keyboard terminal pick: start a wire, cancel it, or finish it on another terminal. */
  const pick = (n: string, tid: string) => {
    const p = get().pending
    if (p && !(p.n === n && p.t === tid)) {
      connect(p, { n, t: tid })
      return 'connected'
    }
    if (p) {
      set({ pending: null })
      return 'cancelled'
    }
    set({ pending: { n, t: tid } })
    return 'started'
  }

  const placeNode = (type: ComponentType, x: number, y: number, profileId?: string) => {
    const p = profileById(profileId)
    const nd = p && p.type === type ? makeDeviceNode(p, snap(x), snap(y)) : makeNode(type, snap(x), snap(y))
    pushHist()
    set((s) => ({ nodes: s.nodes.concat([nd]), sel: { nodes: [nd.id], wire: null } }))
    return nd
  }

  const initialSettings = getSettings()

  const openedLog = (): LogEntry => ({ time: 'Day 1 06:00', sev: 'info', text: `Project opened. Rule set v${RULESET_VERSION} loaded.` })

  return {
    projectId: null,
    projectName: '',
    createdAt: new Date().toISOString(),
    task: null,
    faults: [],
    nodes: [],
    wires: [],
    sel: EMPTY_SEL,
    tool: 'select',
    view: { x: 20, y: 60, z: 0.6 },
    pending: null,
    mouse: { x: 0, y: 0 },
    hist: [],
    fut: [],
    query: '',
    saved: true,
    savedAt: Date.now(),
    tab: 'meas',
    consoleOpen: true,
    libraryOpen: initialSettings.libraryOpen,
    inspectorOpen: initialSettings.inspectorOpen,
    stepsOpen: initialSettings.stepsOpen,
    legendOpen: false,
    wireFilter: DEFAULT_WIRE_FILTER,
    sim: freshSim(),
    running: false,
    stopped: false,
    marquee: null,
    termPicker: null,
    speed: 0,
    clear: 85,
    log: [openedLog()],
    viewMode: '2d',
    env3d: 'lab',
    settings: {
      showGrid: initialSettings.showGrid,
      snapToGrid: initialSettings.snapToGrid,
      wireStyle: initialSettings.wireStyle,
      showFlow: initialSettings.showFlow,
      simStep: initialSettings.simStep,
    },

    setViewportEl: (el) => {
      viewportEl = el
    },
    setTool: (tool) => set({ tool, pending: null, termPicker: null }),
    setQuery: (query) => set({ query }),
    setTab: (tab) => set({ tab, consoleOpen: true }),
    toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
    // Side-panel collapse state is a per-browser preference, saved in `solarsketch:settings`.
    toggleLibrary: () => {
      const libraryOpen = !get().libraryOpen
      set({ libraryOpen })
      try {
        updateSettings({ libraryOpen })
      } catch {
        // Storage full or unavailable: keep the in-session value.
      }
    },
    // With a task open, Steps and Details share the right side: opening one collapses the other.
    toggleInspector: () => {
      const inspectorOpen = !get().inspectorOpen
      const patch = inspectorOpen && get().task ? { inspectorOpen, stepsOpen: false } : { inspectorOpen }
      set(patch)
      saveDrawers(patch)
    },
    toggleSteps: () => {
      const stepsOpen = !get().stepsOpen
      const patch = stepsOpen ? { stepsOpen, inspectorOpen: false } : { stepsOpen }
      set(patch)
      saveDrawers(patch)
    },
    toggleLegend: () => set((s) => ({ legendOpen: !s.legendOpen })),
    setWireFilter: (patch) => set((s) => ({ wireFilter: { ...s.wireFilter, ...patch } })),
    setClear: (clear) => set({ clear, saved: false }),
    setSpeed: (speed) => set({ speed, saved: false }),
    setViewMode: (viewMode) => set({ viewMode, pending: null, termPicker: null, tool: 'select' }),
    setEnv3d: (env3d) => set({ env3d }),
    jumpToHour: (hour) => {
      const { sim } = get()
      const day = Math.floor(sim.t / 1440)
      let t = day * 1440 + hour * 60
      if (t <= sim.t) t += 1440
      set({ sim: { ...sim, t } })
      addLog('info', `Clock moved to ${clockStr(t)}. Energy totals were not advanced.`)
    },
    select: (sel) => {
      set({ sel, pending: null })
      revealDetails(sel)
    },
    clearSelection: () => set({ pending: null, termPicker: null, sel: EMPTY_SEL }),

    undo: () =>
      set((s) => {
        if (!s.hist.length) return s
        const cur = JSON.stringify({ nodes: s.nodes, wires: s.wires })
        const prev = JSON.parse(s.hist[s.hist.length - 1]) as Snapshot
        return { ...prev, hist: s.hist.slice(0, -1), fut: [cur].concat(s.fut), sel: EMPTY_SEL, saved: false }
      }),
    redo: () =>
      set((s) => {
        if (!s.fut.length) return s
        const cur = JSON.stringify({ nodes: s.nodes, wires: s.wires })
        const next = JSON.parse(s.fut[0]) as Snapshot
        return { ...next, fut: s.fut.slice(1), hist: s.hist.concat([cur]), sel: EMPTY_SEL, saved: false }
      }),
    del: () => {
      const { sel } = get()
      if (!sel.nodes.length && !sel.wire) return
      pushHist()
      set((s) => ({
        nodes: s.nodes.filter((n) => !sel.nodes.includes(n.id)),
        wires: s.wires.filter((w) => w.id !== sel.wire && !sel.nodes.includes(w.a.n) && !sel.nodes.includes(w.b.n)),
        sel: EMPTY_SEL,
      }))
    },
    rotate: () => {
      const ids = get().sel.nodes
      if (!ids.length) return
      pushHist()
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (!ids.includes(n.id)) return n
          const rot = nextRotation(n.rot)
          const { rot: _old, ...rest } = n
          void _old
          const next = rot ? { ...rest, rot } : rest
          // Turn about the card's centre so it stays where the user is looking.
          const c = keepCentre(n, next)
          return { ...next, x: snap(c.x), y: snap(c.y) }
        }),
      }))
    },
    nudge: (dx, dy, large) => {
      const ids = get().sel.nodes
      if (!ids.length) return
      const d = large ? NUDGE_LARGE : NUDGE
      pushHist()
      set((s) => ({ nodes: s.nodes.map((n) => (ids.includes(n.id) ? { ...n, x: n.x + dx * d, y: n.y + dy * d } : n)) }))
    },
    openTermPicker: (termPicker) => set({ termPicker }),
    pickTerminal: (n, tid) => {
      const r = pick(n, tid)
      set({ termPicker: null })
      const node = get().nodes.find((x) => x.id === n)
      if (r === 'started' && node) {
        const p = terminalPos(node, tid)
        set({ mouse: { x: p.x + p.dx * 40, y: p.y + p.dy * 40 } })
      }
    },
    setPanKey: (held) => {
      panKey = held
    },
    duplicate: () => pasteClip(copySel()),
    copy: () => {
      clip = copySel() ?? clip
    },
    paste: () => pasteClip(clip),
    save: () => {
      void get()
        .persist({ manual: true })
        .then((ok) => ok && addLog('info', 'Project saved (spec versions preserved).'))
    },
    toDocument: () => {
      const s = get()
      if (!s.projectId) return null
      return {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        id: s.projectId,
        name: s.projectName,
        createdAt: s.createdAt,
        updatedAt: new Date().toISOString(),
        ruleSetVersion: RULESET_VERSION,
        catalogVersion: CATALOG_VERSION,
        nodes: s.nodes,
        wires: s.wires,
        settings: { clearSky: s.clear, speed: s.speed },
        ...(s.task ? { task: s.task } : {}),
        ...(s.faults.length ? { faults: pruneFaults(s.faults, s.nodes) } : {}),
      }
    },
    persist: async ({ manual = false } = {}) => {
      const before = get()
      const doc = before.toDocument()
      if (!doc) return false
      if (!isStorageAvailable()) {
        if (manual) toast.warning(t('Browser storage is unavailable, so this project cannot be saved. Export it from My Projects to keep a copy.'))
        return false
      }
      try {
        lastWritten.set(doc.id, doc.updatedAt)
        await saveProject(doc)
        // Only mark saved if nothing changed while the write was in flight.
        const now = get()
        const unchanged = now.projectId === doc.id && now.nodes === before.nodes && now.wires === before.wires && now.projectName === before.projectName && now.clear === before.clear && now.speed === before.speed && now.task === before.task && now.faults === before.faults
        if (unchanged) set({ saved: true, savedAt: Date.now() })
        const meta = await getMeta()
        if (meta.lastProjectId !== doc.id || !meta.storageNoticeShown) await setMeta({ ...meta, lastProjectId: doc.id, storageNoticeShown: true })
        if (!meta.storageNoticeShown) toast.info(t('Projects are saved in this browser only. Clearing browser data deletes them, so export backups from My Projects.'), { duration: 10000 })
        return true
      } catch (e) {
        reportWriteError(e, t('The project could not be saved.'), 'save-failed')
        return false
      }
    },
    loadDocument: (doc) => {
      drag = null
      set({
        projectId: doc.id,
        projectName: doc.name,
        createdAt: doc.createdAt,
        task: doc.task ?? null,
        // Only one right drawer is open during a task; Steps wins when both were saved open.
        ...(doc.task && get().stepsOpen && get().inspectorOpen ? { inspectorOpen: false } : {}),
        faults: doc.faults ?? [],
        nodes: doc.nodes,
        wires: doc.wires,
        clear: doc.settings.clearSky,
        speed: doc.settings.speed,
        hist: [],
        fut: [],
        sel: EMPTY_SEL,
        pending: null,
        termPicker: null,
        marquee: null,
        sim: freshSim(),
        running: false,
        stopped: false,
        saved: true,
        savedAt: Date.parse(doc.updatedAt) || Date.now(),
        log: [openedLog()],
      })
      lastWritten.set(doc.id, doc.updatedAt)
      if (isStorageAvailable()) setLastProjectId(doc.id).catch(() => undefined)
      setTimeout(() => get().fit(), 0)
    },
    clearTask: () => set({ task: null, saved: false }),
    addFault: (f) => {
      const fault: Fault = { ...f, id: uid('f') }
      set((s) => ({ faults: s.faults.concat([fault]), saved: false }))
      if (!f.hidden && (f.startAt ?? -1) > get().sim.t) addLog('info', `Fault scheduled for ${clockStr(f.startAt!)}.`)
    },
    removeFault: (id) => set((s) => ({ faults: s.faults.filter((f) => f.id !== id), saved: false })),
    repairNode: (nodeId) => {
      const s = get()
      const node = s.nodes.find((n) => n.id === nodeId)
      if (!node) return
      const fixed = activeFaults(s.faults, s.sim.t).filter((f) => f.target === nodeId)
      const name = nodeTitle(node)
      if (!fixed.length) {
        addLog('info', `Inspected ${name}: no fault found.`)
        return
      }
      const ids = new Set(fixed.map((f) => f.id))
      set((st) => ({ faults: st.faults.filter((f) => !ids.has(f.id)), saved: false }))
      fixed.forEach((f) => addLog('info', `Repaired ${name}: ${FAULT_DEFS[f.kind].label.toLowerCase()} cleared.`))
    },
    resetRcd: (boardId) => {
      set((s) => ({ sim: { ...s.sim, rcdTripped: (s.sim.rcdTripped ?? []).filter((b) => b !== boardId) } }))
      addLog('info', 'RCD reset. If earth leakage remains, it will trip again when the faulty appliance switches on.')
    },
    renameProject: (name) => {
      const n = name.trim().slice(0, 120)
      if (n) set({ projectName: n, saved: false })
    },
    setSettings: (patch) => {
      set((s) => ({ settings: { ...s.settings, ...patch } }))
      try {
        updateSettings(patch)
      } catch {
        // Storage full or unavailable: keep the in-session value.
      }
    },
    addLog,

    addAtCenter: (type, profileId) => {
      if (!viewportEl) return
      const r = viewportEl.getBoundingClientRect()
      const p = toWorld(r.left + r.width / 2, r.top + r.height / 2)
      placeNode(type, p.x - 88, p.y - 50, profileId)
    },
    dropAt: (type, clientX, clientY, profileId) => {
      const p = toWorld(clientX, clientY)
      const nd = placeNode(type, p.x - 88, p.y - 24, profileId)
      addLog('info', `Placed ${nodeTitle(nd)}.`)
    },
    updateSpec: (nodeId, key, value) => {
      pushHist()
      set((s) => ({
        nodes: s.nodes.map((x) => {
          if (x.id !== nodeId) return x
          const specs = { ...x.specs, [key]: value }
          // Editing a spec away from the profile makes the component custom.
          const p = profileById(x.profile)
          const { profile: _drop, ...rest } = x
          void _drop
          return p && matchesProfile(specs, p) ? { ...x, specs } : { ...rest, specs }
        }),
      }))
    },
    applyProfile: (nodeId, profileId) => {
      const p = profileById(profileId)
      if (!p) return
      pushHist()
      set((s) => ({ nodes: s.nodes.map((x) => (x.id === nodeId && x.type === p.type ? { ...x, specs: profileSpecs(p, x.specs), ver: p.ver, profile: p.id } : x)) }))
    },
    updateWire: (wireId, patch) => {
      pushHist()
      set((s) => ({ wires: s.wires.map((x) => (x.id === wireId ? { ...x, ...patch } : x)) }))
    },

    zoomAt: (f, cx, cy) => {
      if (!viewportEl) return
      const r = viewportEl.getBoundingClientRect()
      const v = get().view
      const z = Math.max(0.25, Math.min(2.5, v.z * f))
      const px = (cx ?? r.left + r.width / 2) - r.left
      const py = (cy ?? r.top + r.height / 2) - r.top
      set({ view: { z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z } })
    },
    fit: () => {
      const ns = get().nodes
      if (!viewportEl || !ns.length) return
      const r = viewportEl.getBoundingClientRect()
      const x0 = Math.min(...ns.map((n) => n.x)) - 30
      const y0 = Math.min(...ns.map((n) => n.y)) - 50
      const x1 = Math.max(...ns.map((n) => n.x + nodeSize(n).w)) + 30
      const y1 = Math.max(...ns.map((n) => n.y + nodeSize(n).h)) + 30
      const z = Math.max(0.25, Math.min(1.4, Math.min(r.width / (x1 - x0), r.height / (y1 - y0))))
      set({ view: { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z } })
    },

    viewportDown: (e) => {
      if (e.button !== 0 && e.button !== 1) return
      const s = get()
      // Select tool, left button on empty canvas: box select (Shift adds). Otherwise pan.
      if (e.button === 0 && s.tool === 'select' && !panKey && !s.pending && viewportEl) {
        const w = toWorld(e.clientX, e.clientY)
        drag = { mode: 'box', sx: e.clientX, sy: e.clientY, wx: w.x, wy: w.y, base: e.shiftKey ? s.sel.nodes : [], moved: false }
        if (s.termPicker) set({ termPicker: null })
        return
      }
      const v = s.view
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false }
    },
    nodeDown: (id, e) => {
      e.stopPropagation()
      const s = get()
      if (s.tool === 'pan' || e.button === 1 || panKey) {
        const v = s.view
        if (e.button === 0 || e.button === 1) drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false }
        return
      }
      if (e.button !== 0) return
      let ids = s.sel.nodes
      if (e.shiftKey) ids = ids.includes(id) ? ids.filter((x) => x !== id) : ids.concat([id])
      else if (!ids.includes(id)) ids = [id]
      set({ sel: { nodes: ids, wire: null } })
      revealDetails(get().sel)
      if (s.tool === 'wire') return
      const orig: Record<string, { x: number; y: number }> = {}
      s.nodes.forEach((n) => {
        if (ids.includes(n.id)) orig[n.id] = { x: n.x, y: n.y }
      })
      drag = { mode: 'node', sx: e.clientX, sy: e.clientY, orig, moved: false }
    },
    termDown: (n, t, e) => {
      e.stopPropagation()
      e.preventDefault()
      if (pick(n, t) !== 'started') return
      set({ mouse: toWorld(e.clientX, e.clientY), termPicker: null })
      drag = { mode: 'wire', sx: e.clientX, sy: e.clientY, moved: false }
    },
    termUp: (n, t, e) => {
      const p = get().pending
      if (p && drag?.mode === 'wire' && drag.moved && !(p.n === n && p.t === t)) {
        e.stopPropagation()
        drag = null
        connect(p, { n, t })
      }
    },
    pointerMove: (e) => {
      const d = drag
      if (viewportEl) {
        // Throttle cursor updates unless a wire is being drawn.
        if (get().pending || Date.now() - lastMouseUpdate > 50) {
          lastMouseUpdate = Date.now()
          set({ mouse: toWorld(e.clientX, e.clientY) })
        }
      }
      if (!d) return
      const dx = e.clientX - d.sx
      const dy = e.clientY - d.sy
      if (!d.moved && Math.hypot(dx, dy) < 3) return
      if (d.mode === 'pan') {
        d.moved = true
        set((s) => ({ view: { ...s.view, x: d.ox + dx, y: d.oy + dy } }))
      } else if (d.mode === 'box') {
        d.moved = true
        const w = toWorld(e.clientX, e.clientY)
        const m = { x0: Math.min(d.wx, w.x), y0: Math.min(d.wy, w.y), x1: Math.max(d.wx, w.x), y1: Math.max(d.wy, w.y) }
        // Select every component the box touches.
        const hit = get()
          .nodes.filter((n) => {
            const sz = nodeSize(n)
            return n.x < m.x1 && n.x + sz.w > m.x0 && n.y < m.y1 && n.y + sz.h > m.y0
          })
          .map((n) => n.id)
        const ids = d.base.concat(hit.filter((id) => !d.base.includes(id)))
        set({ marquee: m, sel: { nodes: ids, wire: null } })
      } else if (d.mode === 'node') {
        if (!d.moved) {
          d.moved = true
          pushHist()
        }
        const z = get().view.z
        set((s) => ({ nodes: s.nodes.map((n) => (d.orig[n.id] ? { ...n, x: snap(d.orig[n.id].x + dx / z), y: snap(d.orig[n.id].y + dy / z) } : n)) }))
      } else d.moved = true
    },
    pointerUp: () => {
      const d = drag
      drag = null
      if (!d) return
      if ((d.mode === 'pan' || d.mode === 'box') && !d.moved) set({ sel: d.mode === 'box' && d.base.length ? get().sel : EMPTY_SEL, pending: null })
      if (d.mode === 'box') set({ marquee: null })
      if (d.mode === 'wire' && d.moved) set({ pending: null })
    },

    runToggle: () => {
      const s = get()
      if (s.running) {
        set({ running: false })
        addLog('info', 'Simulation paused.')
        return
      }
      const crit = validateCached(s.nodes, s.wires).issues.filter((i) => i.sev === 'critical').length
      if (crit) {
        set({ tab: 'val', consoleOpen: true })
        addLog('critical', `Simulation blocked: resolve ${crit} critical finding${crit > 1 ? 's' : ''} first.`)
        return
      }
      if (s.stopped) {
        // A new run after Stop starts again from the start of the day.
        set({ running: true, stopped: false, sim: freshSim(), tab: 'meas', consoleOpen: true })
        addLog('info', 'New simulation run started at Day 1 06:00.')
        return
      }
      set({ running: true, tab: 'meas', consoleOpen: true })
      addLog('info', s.sim.started ? 'Simulation resumed.' : 'Simulation started.')
    },
    stop: () => {
      const s = get()
      if (!s.sim.started || s.stopped) return
      set({ running: false, stopped: true })
      addLog('info', `Simulation stopped at ${clockStr(s.sim.t)}. Readings are kept until Reset or the next run.`)
    },
    reset: () => {
      set({ running: false, stopped: false, sim: freshSim(), log: [{ time: clockStr(freshSim().t), sev: 'info', text: 'Simulation reset to Day 1 06:00. Energy totals and the event log were cleared.' }] })
    },
    tick: () => {
      const s = get()
      const v = validateCached(s.nodes, s.wires)
      const { sim, logs } = step(s.sim, v, s.clear, s.speed, s.nodes, s.faults, tickMinutes(s.settings.simStep, s.speed))
      set((st) => ({ sim, log: logs.length ? logs.concat(st.log).slice(0, MAX_LOG) : st.log }))
    },
  }
})

/** Validation for the current project, shared across components. */
export function useValidation() {
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  return validateCached(nodes, wires)
}
