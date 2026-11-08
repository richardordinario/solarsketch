/** True when the browser can create a WebGL context (PRD: offer a 2D alternative otherwise). */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
