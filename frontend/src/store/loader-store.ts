import { create } from 'zustand'

interface LoaderState {
  /** Text under the sun while a project or page opens; null hides the loader (components/app/sun-loader.tsx). */
  label: string | null
}

export const useLoaderStore = create<LoaderState>(() => ({ label: null }))

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

/**
 * Runs `work` behind the sun loader, keeping it up at least `minMs` (so the animation reads as a
 * loader rather than a flash) and until the next page has painted.
 */
export async function withLoader<T>(label: string, work: () => Promise<T>, minMs = 700): Promise<T> {
  useLoaderStore.setState({ label })
  const started = performance.now()
  try {
    return await work()
  } finally {
    await nextPaint()
    await wait(Math.max(0, minMs - (performance.now() - started)))
    useLoaderStore.setState({ label: null })
  }
}
