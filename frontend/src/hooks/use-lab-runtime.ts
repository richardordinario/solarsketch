import { useEffect } from 'react'

import { confirmDelete, useConfirmStore } from '@/store/confirm-store'
import { useLabStore } from '@/store/lab-store'

const TICK_MS = 220

const ARROWS: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }

/** The canvas component that has keyboard focus, if any (see NodeView in canvas.tsx). */
function focusedNodeId() {
  const el = document.activeElement as HTMLElement | null
  return el?.dataset.nodeId ?? null
}

/** Focus is on the sheet itself (a component or nothing), not on a control that uses arrows. */
function focusOnSheet() {
  const el = document.activeElement
  return !el || el === document.body || !!focusedNodeId() || (el as HTMLElement).dataset.canvas === 'viewport'
}

/** Window-level pointer/keyboard handlers and the simulation clock. */
export function useLabRuntime() {
  useEffect(() => {
    const s = () => useLabStore.getState()

    const onMove = (e: MouseEvent) => s().pointerMove(e)
    const onUp = () => s().pointerUp()
    const onKey = (e: KeyboardEvent) => {
      const tg = (e.target as HTMLElement).tagName
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      // The delete confirmation handles its own keys (Enter, Esc).
      if (useConfirmStore.getState().req) return
      const a = s()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) a.redo()
        else a.undo()
      } else if (mod && k === 'y') {
        e.preventDefault()
        a.redo()
      } else if (mod && k === 'd') {
        e.preventDefault()
        a.duplicate()
      } else if (mod && k === 'c') a.copy()
      else if (mod && k === 'v') {
        e.preventDefault()
        a.paste()
      } else if (mod && k === 's') {
        e.preventDefault()
        a.save()
      } else if (mod) return
      else if (k === 'delete' || k === 'backspace') {
        e.preventDefault()
        confirmDelete()
      } else if (k === 'escape') {
        if (a.termPicker) a.openTermPicker(null)
        else a.clearSelection()
      } else if (ARROWS[k] && focusOnSheet() && a.sel.nodes.length && a.viewMode === '2d') {
        e.preventDefault()
        a.nudge(ARROWS[k][0], ARROWS[k][1], e.shiftKey)
      } else if (k === ' ' && focusOnSheet() && !focusedNodeId()) {
        // Hold Space and drag to pan with the select tool.
        e.preventDefault()
        a.setPanKey(true)
      } else if (k === 'v') a.setTool('select')
      else if (a.viewMode === '3d' && /^[wasdqe]$/.test(k)) return // WASD/QE walk the 3D camera (lab-3d.tsx)
      else if (k === 'w') {
        // With a component focused, W opens its terminal picker for keyboard wiring.
        const id = focusedNodeId()
        if (id && a.viewMode === '2d') {
          e.preventDefault()
          a.openTermPicker(id)
        } else a.setTool('wire')
      }
      else if (k === 'h') a.setTool('pan')
      else if (k === 'r') a.rotate()
      else if (k === 'x') a.setWireFilter({ mode: a.wireFilter.mode === 'hidden' ? 'all' : 'hidden' })
      else if (k === 'f') a.fit()
      else if (k === '=' || k === '+') a.zoomAt(1.2)
      else if (k === '-') a.zoomAt(1 / 1.2)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') s().setPanKey(false)
    }
    const onBlur = () => s().setPanKey(false)

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    const iv = setInterval(() => {
      if (s().running) s().tick()
    }, TICK_MS)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      clearInterval(iv)
    }
  }, [])
}
