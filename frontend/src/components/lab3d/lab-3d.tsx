/**
 * 3D Virtual Laboratory (PRD Module 3, P1). A spatial view of the same project and simulation
 * state as the 2D sheet; it never computes electrical behaviour itself. Loaded lazily.
 */
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { CATALOG, LOAD_TYPES, isBattery, isPv } from '@/engine/catalog'
import { nodeTitle } from '@/engine/profiles'
import { terminal } from '@/engine/geometry'
import { wireFlows, type WireFlow } from '@/engine/flows'
import { BENCH_H, PV_TILT, cablePoints, layout3d, routeCable, sunDirection, terminalPos3d, type Environment3D, type Layout3D, type Placement, type Vec3 } from '@/engine/layout3d'
import { compute, isDaylight, type Measurements } from '@/engine/simulation'
import type { LabNode, TerminalType, Wire } from '@/engine/types'
import { nodeMap, type ValidationResult } from '@/engine/validation'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { useLabStore, useValidation } from '@/store/lab-store'
import { WireFilterNotice } from '@/components/lab/wire-filter-notice'
import { useWireVisibility } from '@/hooks/use-wire-visibility'

import { TERMINAL_COLOR, WIRE_COLOR } from '../lab/colors'
import { hasWebGL } from './webgl'
import { t } from '@/i18n'

/** Resolve a CSS custom property (theme-aware) to a colour Three.js understands. */
function cssVar(expr: string) {
  const m = /var\((--[\w-]+)\)/.exec(expr)
  if (!m) return expr
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888888'
}

function usePalette() {
  const { theme } = useTheme()
  return useMemo(() => {
    void theme
    const term = Object.fromEntries(Object.entries(TERMINAL_COLOR).map(([k, v]) => [k, cssVar(v)])) as Record<TerminalType, string>
    return {
      dark: theme === 'dark',
      term,
      primary: cssVar('var(--primary)'),
      floor: theme === 'dark' ? '#454a52' : '#e4e1df',
      wall: theme === 'dark' ? '#68707a' : '#efedeb',
      bench: theme === 'dark' ? '#6c727b' : '#c9c4c0',
      body: theme === 'dark' ? '#6a7079' : '#f4f2f0',
      bodyDark: theme === 'dark' ? '#3a3e44' : '#2b2e33',
      frame: '#b9bec4',
    }
  }, [theme])
}

type Palette = ReturnType<typeof usePalette>

/** Procedural PV cell texture: blue cells separated by thin busbars. */
function usePvTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 384
    const g = c.getContext('2d')!
    g.fillStyle = '#d9dde3'
    g.fillRect(0, 0, c.width, c.height)
    const cols = 6
    const rows = 10
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        g.fillStyle = (i + j) % 2 ? '#1c2d55' : '#1a2a50'
        g.fillRect(4 + i * 41.6, 4 + j * 37.6, 39, 35)
      }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

interface EquipmentProps {
  node: LabNode
  p: Placement
  selected: boolean
  live: Measurements | null
  soc: number
  supplied: boolean
  pal: Palette
  onSelect: (e: ThreeEvent<MouseEvent>) => void
  onHover: (hovering: boolean) => void
}

function Bench({ p, pal }: { p: Placement; pal: Palette }) {
  const [w, , d] = p.size
  const tw = Math.max(0.7, w + 0.3)
  const td = Math.max(0.5, d + 0.3)
  const x = p.position[0]
  const z = p.position[2]
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, BENCH_H - 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[tw, 0.04, td]} />
        <meshStandardMaterial color={pal.bench} roughness={0.8} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * (tw - 0.06)) / 2, (BENCH_H - 0.04) / 2, (sz * (td - 0.06)) / 2]}>
          <boxGeometry args={[0.04, BENCH_H - 0.04, 0.04]} />
          <meshStandardMaterial color={pal.frame} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Equipment({ node, p, selected, live, soc, pal, onSelect, onHover, hover }: EquipmentProps & { hover: boolean }) {
  const pvTex = usePvTexture()
  const fanRef = useRef<THREE.Group>(null)
  const [w, h, d] = p.size
  const loadOn = !!live?.onLoads.some((l) => l.id === node.id)
  const outline = selected || hover ? <Edges color={selected ? pal.primary : pal.frame} threshold={20} scale={1.03} /> : null

  useFrame((_, dt) => {
    if (fanRef.current && node.type === 'fan' && loadOn) fanRef.current.rotation.z += dt * 18
  })

  const events = {
    onClick: onSelect,
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHover(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      onHover(false)
      document.body.style.cursor = ''
    },
  }

  let body: React.ReactNode
  // Every PV variant shares the module model; every battery chemistry the battery body.
  switch (isPv(node) ? 'pv' : node.type) {
    case 'pv': {
      const generating = !!live && live.ppv > 1
      body = (
        <group rotation={[-Math.PI / 2 + PV_TILT, 0, 0]}>
          <mesh castShadow {...events}>
            <boxGeometry args={[w, d, h]} />
            <meshStandardMaterial attach="material-0" color={pal.frame} metalness={0.6} roughness={0.35} />
            <meshStandardMaterial attach="material-1" color={pal.frame} metalness={0.6} roughness={0.35} />
            <meshStandardMaterial attach="material-2" color={pal.frame} metalness={0.6} roughness={0.35} />
            <meshStandardMaterial attach="material-3" color={pal.frame} metalness={0.6} roughness={0.35} />
            <meshStandardMaterial attach="material-4" map={pvTex} metalness={0.3} roughness={0.25} emissive={generating ? '#1d3f8a' : '#000000'} emissiveIntensity={generating ? 0.35 : 0} />
            <meshStandardMaterial attach="material-5" color="#d8dade" />
            {outline}
          </mesh>
        </group>
      )
      break
    }
    case 'gnd':
      body = (
        <mesh {...events}>
          <cylinderGeometry args={[0.012, 0.012, h, 12]} />
          <meshStandardMaterial color="#b87333" metalness={0.8} roughness={0.3} />
          {outline}
        </mesh>
      )
      break
    case 'led':
      body = (
        <group>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.8, 6]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh {...events}>
            <sphereGeometry args={[0.13, 24, 16]} />
            <meshStandardMaterial color={loadOn ? '#fff6d6' : '#dddddd'} emissive={loadOn ? '#ffe9a8' : '#000000'} emissiveIntensity={loadOn ? 2.2 : 0} />
            {outline}
          </mesh>
          {loadOn && <pointLight color="#ffe3a0" intensity={3} distance={4} decay={2} />}
        </group>
      )
      break
    case 'fan':
      body = (
        <group>
          <mesh position={[0, -h / 2 + 0.03, 0]} {...events}>
            <cylinderGeometry args={[0.17, 0.2, 0.06, 24]} />
            <meshStandardMaterial color={pal.body} />
          </mesh>
          <mesh position={[0, -0.05, 0]} {...events}>
            <cylinderGeometry args={[0.018, 0.018, h - 0.25, 10]} />
            <meshStandardMaterial color={pal.frame} metalness={0.5} />
          </mesh>
          <group position={[0, h / 2 - 0.18, 0.05]}>
            <mesh {...events}>
              <torusGeometry args={[0.2, 0.012, 8, 32]} />
              <meshStandardMaterial color={pal.frame} />
              {outline}
            </mesh>
            <group ref={fanRef}>
              {[0, 1, 2].map((i) => (
                <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0, 0]}>
                  <boxGeometry args={[0.05, 0.34, 0.006]} />
                  <meshStandardMaterial color="#8fb3d9" />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      )
      break
    case 'grid':
      // Utility pole with a crossarm and service drop.
      body = (
        <group>
          <mesh castShadow {...events}>
            <cylinderGeometry args={[0.1, 0.13, h, 12]} />
            <meshStandardMaterial color="#7a6a58" roughness={0.9} />
            {outline}
          </mesh>
          <mesh position={[0, h / 2 - 0.4, 0]} castShadow>
            <boxGeometry args={[1.4, 0.1, 0.1]} />
            <meshStandardMaterial color="#6b5b4a" />
          </mesh>
          {[-0.55, 0, 0.55].map((x) => (
            <mesh key={x} position={[x, h / 2 - 0.3, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
              <meshStandardMaterial color="#d9d4cc" />
            </mesh>
          ))}
        </group>
      )
      break
    case 'gen': {
      const running = live ? live.ac.pgen > 0 : false
      body = (
        <mesh castShadow receiveShadow {...events}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#d8a21c" roughness={0.5} emissive={running ? '#5a3a00' : '#000000'} emissiveIntensity={running ? 0.4 : 0} />
          {outline}
        </mesh>
      )
      break
    }
    default: {
      const dark = node.type === 'tv' || node.type === 'pc' || node.type === 'laptop' || node.type === 'router'
      const screen = (node.type === 'tv' || node.type === 'pc' || node.type === 'laptop') && loadOn
      body = (
        <mesh castShadow receiveShadow {...events}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={dark ? '#16181b' : isBattery(node) ? pal.bodyDark : pal.body} roughness={0.55} emissive={screen ? '#4a78c9' : '#000000'} emissiveIntensity={screen ? 0.8 : 0} />
          {outline}
        </mesh>
      )
    }
  }

  // Front-panel indicators.
  const indicator = (() => {
    if (node.type === 'inv') {
      const color = live?.overload ? '#ff3b30' : live?.invOn ? '#34c759' : '#555'
      return (
        <mesh position={[w / 2 - 0.06, h / 2 - 0.06, d / 2 + 0.002]}>
          <circleGeometry args={[0.018, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )
    }
    if (isBattery(node)) {
      const frac = Math.max(0, Math.min(1, soc / 100))
      return (
        <group position={[0, 0.02, d / 2 + 0.002]}>
          <mesh>
            <planeGeometry args={[w * 0.6, 0.05]} />
            <meshBasicMaterial color="#111" />
          </mesh>
          <mesh position={[(-w * 0.6 * (1 - frac)) / 2, 0, 0.001]}>
            <planeGeometry args={[Math.max(0.001, w * 0.6 * frac), 0.04]} />
            <meshBasicMaterial color={soc < 20 ? '#ff3b30' : '#34c759'} />
          </mesh>
        </group>
      )
    }
    if (node.type === 'mppt' || node.type === 'pwm') {
      const charging = !!live && live.cc > 1
      return (
        <mesh position={[0, h / 2 - 0.07, d / 2 + 0.002]}>
          <planeGeometry args={[w * 0.6, 0.06]} />
          <meshBasicMaterial color={charging ? '#2f7de1' : '#1e2227'} />
        </mesh>
      )
    }
    if (node.type === 'fridge') {
      return (
        <mesh position={[w / 2 - 0.06, 0.2, d / 2 + 0.01]}>
          <boxGeometry args={[0.02, 0.5, 0.03]} />
          <meshStandardMaterial color={pal.frame} metalness={0.6} />
        </mesh>
      )
    }
    if ('closed' in node.specs) {
      // Isolator / breaker handle: green and up when closed, red and down when open.
      const on = node.specs.closed !== 0
      return (
        <mesh position={[0, on ? h * 0.12 : -h * 0.12, d / 2 + 0.008]}>
          <boxGeometry args={[Math.min(0.03, w * 0.5), h * 0.22, 0.015]} />
          <meshBasicMaterial color={on ? '#34c759' : '#ff3b30'} />
        </mesh>
      )
    }
    return null
  })()

  return (
    <group position={p.position} rotation={[0, p.rotY, 0]}>
      {body}
      {indicator}
      {isPv(node) && (
        // Support legs.
        <group>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * w) / 2.4, -0.38, 0.1]}>
              <boxGeometry args={[0.04, 0.75, 0.04]} />
              <meshStandardMaterial color={pal.frame} metalness={0.5} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

function liveStatus(node: LabNode, m: Measurements | null, soc: number, supplied: boolean) {
  if (!m) return ''
  switch (isPv(node) ? 'pv' : isBattery(node) ? 'bat' : node.type) {
    case 'pv':
      return t(m.ppv > 1 ? 'Generating' : 'Idle')
    case 'mppt':
    case 'pwm':
      return t('{w} W to battery', { w: m.cc.toFixed(0) })
    case 'bat':
      return `SOC ${soc.toFixed(0)}% · ${m.pbat >= 0 ? '+' : ''}${m.pbat.toFixed(0)} W`
    case 'inv':
      return m.overload ? t('Overload') : m.invOn ? `${t('ON')} · ${m.pload.toFixed(0)} W` : t('OFF')
    case 'dcm':
    case 'acm': {
      const r = m.meters[node.id]
      return r ? `${r.v.toFixed(0)} V · ${r.a.toFixed(1)} A · ${r.w.toFixed(0)} W` : ''
    }
    default:
      if (node.specs.closed === 0) return t('OPEN · switched off')
      if (LOAD_TYPES.includes(node.type)) return m.onLoads.some((l) => l.id === node.id) ? `${t('ON')} · ${node.specs.p} W` : t(supplied ? 'OFF (schedule)' : 'Not supplied')
      return ''
  }
}

/** Terminal markers; labelled when their component is selected. */
function Terminals({ node, p, showLabels, pal }: { node: LabNode; p: Placement; showLabels: boolean; pal: Palette }) {
  const def = CATALOG[node.type]
  return (
    <>
      {def.L.concat(def.R).map(([tid, , type]) => {
        const pos = terminalPos3d(node, tid, p)
        return (
          <group key={tid} position={pos}>
            <mesh>
              <sphereGeometry args={[showLabels ? 0.03 : 0.022, 14, 10]} />
              <meshStandardMaterial color={pal.term[type]} emissive={showLabels ? pal.term[type] : '#000'} emissiveIntensity={showLabels ? 0.6 : 0} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/** Polyline with filleted corners, so routed cables bend instead of kinking. */
function roundedPath(points: Vec3[], radius = 0.06) {
  const v = points.map((p) => new THREE.Vector3(...p))
  const path = new THREE.CurvePath<THREE.Vector3>()
  let cursor = v[0]
  for (let i = 1; i < v.length - 1; i++) {
    const prev = v[i - 1]
    const cur = v[i]
    const next = v[i + 1]
    const r = Math.min(radius, cur.distanceTo(prev) / 2, cur.distanceTo(next) / 2)
    const inPt = cur.clone().add(prev.clone().sub(cur).setLength(r))
    const outPt = cur.clone().add(next.clone().sub(cur).setLength(r))
    if (cursor.distanceTo(inPt) > 1e-5) path.add(new THREE.LineCurve3(cursor, inPt))
    path.add(new THREE.QuadraticBezierCurve3(inPt, cur, outPt))
    cursor = outPt
  }
  path.add(new THREE.LineCurve3(cursor, v[v.length - 1]))
  return path
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const TRACE_PULSES = 6

/**
 * Route tracer for the selected cable: glowing pulses travel along it and both ends beacon, so
 * the eye can follow where it goes. Pulses run end a → b, or with the current while the
 * simulation has it flowing (speed grows with amps, like the 2D flow dots). Display only.
 * Under reduced motion the pulses stand still along the cable.
 */
function CableTrace({ curve, radius, color, flow }: { curve: THREE.Curve<THREE.Vector3>; radius: number; color: string; flow: WireFlow | null }) {
  const pulses = useRef<(THREE.Mesh | null)[]>([])
  const beacons = useRef<(THREE.Mesh | null)[]>([])
  const reduced = useMemo(() => reducedMotion(), [])
  const len = useMemo(() => curve.getLength(), [curve])
  const ends = useMemo(() => [curve.getPointAt(0), curve.getPointAt(1)], [curve])
  const place = (u0: number) => {
    pulses.current.forEach((m, i) => {
      if (!m) return
      let u = (u0 + i / TRACE_PULSES) % 1
      if (flow?.dir === -1) u = 1 - u
      m.position.copy(curve.getPointAt(u))
    })
  }
  useEffect(() => place(0))
  useFrame(({ clock }) => {
    if (reduced) return
    const speed = flow ? 0.25 * (1 + Math.log2(1 + flow.amps)) : 0.5 // m/s along the cable
    place(((clock.elapsedTime * speed) / Math.max(len, 0.01)) % 1)
    const s = 1 + 0.35 * Math.sin(clock.elapsedTime * 4)
    beacons.current.forEach((m) => m?.scale.setScalar(s))
  })
  const pr = Math.max(radius * 2.2, 0.018)
  return (
    <group>
      {Array.from({ length: TRACE_PULSES }, (_, i) => (
        <mesh key={i} ref={(m) => void (pulses.current[i] = m)} raycast={() => null}>
          <sphereGeometry args={[pr, 12, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {ends.map((p, i) => (
        <mesh key={'e' + i} position={p} ref={(m) => void (beacons.current[i] = m)} raycast={() => null}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** `dim`: faded context cable under the wire filter, not clickable. `flow`: the selected cable's current, for the trace. */
function Cable({ wire, points, routed, color, gy, fault, selected, dim, flow, onSelect }: { wire: Wire; points: Vec3[]; routed: boolean; color: string; gy: boolean; fault: boolean; selected: boolean; dim: boolean; flow: WireFlow | null; onSelect: (e: ThreeEvent<MouseEvent>) => void }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const curve = useMemo(() => (routed ? roundedPath(points) : new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(...v)))), [points, routed])
  const r = 0.006 + Math.sqrt(parseFloat(wire.gauge)) * 0.0016
  const geom = useMemo(() => new THREE.TubeGeometry(curve, routed ? Math.max(64, points.length * 24) : 48, selected ? r * 1.6 : r, 8, false), [curve, routed, points.length, r, selected])
  useFrame(({ clock }) => {
    if (mat.current && fault) mat.current.emissiveIntensity = 0.4 + 0.4 * Math.sin(clock.elapsedTime * 5)
  })
  return (
    <>
    {selected && <CableTrace curve={curve} radius={r} color={gy ? '#f2d43a' : color} flow={flow} />}
    <mesh
      geometry={geom}
      castShadow={!dim}
      raycast={dim ? () => null : undefined}
      onClick={onSelect}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <meshStandardMaterial ref={mat} color={gy ? '#3fae4c' : color} roughness={0.6} emissive={fault ? '#ff2a00' : selected ? color : '#000000'} emissiveIntensity={fault ? 0.6 : selected ? 0.5 : 0} transparent={dim} opacity={dim ? 0.15 : 1} depthWrite={!dim} />
    </mesh>
    </>
  )
}

function Room({ env, bounds, pal, day }: { env: Environment3D; bounds: [number, number, number, number]; pal: Palette; day: boolean }) {
  const [x0, x1, z0, z1] = bounds
  const w = Math.max(10, x1 - x0 + 4)
  const d = Math.max(8, z1 - z0 + 4)
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  if (env === 'rooftop') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
          <planeGeometry args={[w + 20, d + 20]} />
          <meshStandardMaterial color={pal.dark ? '#3f5a44' : '#9fbf8a'} />
        </mesh>
        {/* House under the array */}
        <mesh position={[0, 1.6, -2.4]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(6, w - 4), 3.2, 4.4]} />
          <meshStandardMaterial color={pal.wall} />
        </mesh>
        <mesh position={[0, 3.2 + 0.55, -2.25]} rotation={[PV_TILT, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(6.6, w - 3.4), 0.08, 4.9]} />
          <meshStandardMaterial color={pal.dark ? '#7c4c42' : '#a2584a'} roughness={0.9} />
        </mesh>
        {/* Utility area slab */}
        <mesh position={[cx, 0.02, cz + 1]} receiveShadow>
          <boxGeometry args={[w - 4, 0.04, d / 2]} />
          <meshStandardMaterial color={pal.floor} />
        </mesh>
        {!day && <pointLight position={[cx, 2.6, cz + 2]} intensity={6} distance={10} color="#ffe2b0" />}
      </group>
    )
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={pal.floor} roughness={0.9} />
      </mesh>
      <gridHelper args={[Math.max(w, d), Math.round(Math.max(w, d)), pal.dark ? '#5d636c' : '#cfcac6', pal.dark ? '#50565e' : '#dcd8d5']} position={[cx, 0.002, cz]} />
      <mesh position={[cx, 1.6, cz - d / 2]} receiveShadow>
        <planeGeometry args={[w, 3.2]} />
        <meshStandardMaterial color={pal.wall} />
      </mesh>
      <mesh position={[cx - w / 2, 1.6, cz]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, 3.2]} />
        <meshStandardMaterial color={pal.wall} />
      </mesh>
      <pointLight position={[cx, 3, cz]} intensity={day ? 2 : 8} distance={14} color="#fff4e0" />
    </group>
  )
}

/** A DOM label pinned to a world position. Rendered outside the Canvas (see LabelProjector). */
interface Label {
  key: string
  at: Vec3
  content: React.ReactNode
  emphasis: boolean
}

/**
 * Projects label anchors to screen space every frame and moves the DOM labels directly,
 * avoiding per-frame React renders and drei <Html> portals (which break on unmount).
 */
function LabelProjector({ anchors, els }: { anchors: Label[]; els: React.RefObject<Map<string, HTMLDivElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = els.current?.get(a.key)
      if (!el) continue
      v.set(...a.at).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2
      el.style.display = visible ? '' : 'none'
      if (visible) el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
    }
  })
  return null
}


/** Camera position that frames the whole layout. */
function framing(layout: Layout3D): Vec3 {
  const [x0, x1, z0, z1] = layout.bounds
  const span = Math.max(6, x1 - x0, (z1 - z0) * 1.3)
  const [cx, , cz] = layout.center
  return layout.env === 'rooftop' ? [cx + span * 0.35, span * 0.55 + 2, cz + span * 0.8] : [cx + span * 0.08, span * 0.38 + 1, cz + span * 0.62]
}

/** Frame the layout when the 3D view opens or the environment changes, without remounting the Canvas. */
function CameraRig({ layout }: { layout: Layout3D }) {
  const camera = useThree((s) => s.camera)
  const env = layout.env
  // Re-frame only on environment change, not on every edit; the closure holds this render's layout.
  useEffect(() => {
    camera.position.set(...framing(layout))
    camera.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, env])
  return null
}

/** [right, forward, up] per key. */
const WALK_KEYS: Record<string, [number, number, number]> = {
  w: [0, 1, 0], arrowup: [0, 1, 0],
  s: [0, -1, 0], arrowdown: [0, -1, 0],
  a: [-1, 0, 0], arrowleft: [-1, 0, 0],
  d: [1, 0, 0], arrowright: [1, 0, 0],
  e: [0, 0, 1],
  q: [0, 0, -1],
}
const WALK_SPEED = 3 // metres per second; Shift runs at 2.5×
const EYE_MIN = 0.3 // keep the camera above the floor
const EYE_MAX = 40

/** WASD / arrow keys walk the camera across the floor, Q/E lower and raise it; the orbit target moves with it. */
function WalkControls() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const held = useRef(new Set<string>())
  const run = useRef(false)

  useEffect(() => {
    const keys = held.current
    const skip = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      // Leave keys to form fields and to buttons/radios that use arrows themselves.
      return e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable || (el.getAttribute?.('role') ?? '').startsWith('radio')
    }
    const down = (e: KeyboardEvent) => {
      run.current = e.shiftKey
      const k = e.key.toLowerCase()
      if (!WALK_KEYS[k] || skip(e)) return
      e.preventDefault()
      keys.add(k)
    }
    const up = (e: KeyboardEvent) => {
      run.current = e.shiftKey
      keys.delete(e.key.toLowerCase())
    }
    const reset = () => keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [])

  useFrame((_, dt) => {
    if (!held.current.size) return
    let f = 0
    let r = 0
    let u = 0
    for (const k of held.current) {
      r += WALK_KEYS[k][0]
      f += WALK_KEYS[k][1]
      u += WALK_KEYS[k][2]
    }
    if (!f && !r && !u) return
    // Move along the floor in the direction the camera faces, whatever its pitch.
    const fwd = camera.getWorldDirection(new THREE.Vector3())
    fwd.y = 0
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize()
    const step = WALK_SPEED * (run.current ? 2.5 : 1) * Math.min(dt, 0.1)
    const move = fwd.multiplyScalar(f).add(right.multiplyScalar(r)).setY(u).normalize().multiplyScalar(step)
    move.y = THREE.MathUtils.clamp(camera.position.y + move.y, EYE_MIN, EYE_MAX) - camera.position.y
    camera.position.add(move)
    if (controls) {
      controls.target.add(move)
      controls.update()
    }
  })
  return null
}

/** Floor trunking (and a ceiling tray when ceiling loads exist) that routed cables run in. */
function Trays({ layout, highUsed, pal }: { layout: Layout3D; highUsed: boolean; pal: Palette }) {
  const [x0, x1] = layout.bounds
  const len = x1 - x0
  const cx = (x0 + x1) / 2
  const color = pal.dark ? '#565c63' : '#bdb7b2'
  return (
    <group>
      <mesh position={[cx, 0.02, layout.trayZ]} receiveShadow>
        <boxGeometry args={[len, 0.03, 0.44]} />
        <meshStandardMaterial color={color} roughness={0.7} transparent opacity={0.55} />
      </mesh>
      {highUsed && (
        <mesh position={[cx, layout.ceilingY + 0.03, layout.trayZ]}>
          <boxGeometry args={[len, 0.03, 0.44]} />
          <meshStandardMaterial color={color} roughness={0.7} transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  )
}

interface SceneProps {
  routed: boolean
  nodes: LabNode[]
  wires: Wire[]
  v: ValidationResult
  env: Environment3D
  layout: Layout3D
  hoverId: string | null
  setHoverId: (id: string | null) => void
  anchors: Label[]
  labelEls: React.RefObject<Map<string, HTMLDivElement>>
  /** Current in the selected wire while the simulation runs, for its trace. */
  selFlow: WireFlow | null
}

function Scene({ nodes, wires, v, env, layout, hoverId, setHoverId, anchors, labelEls, routed, selFlow }: SceneProps) {
  const pal = usePalette()
  const sel = useLabStore((s) => s.sel)
  const select = useLabStore((s) => s.select)
  const sim = useLabStore((s) => s.sim)
  const clear = useLabStore((s) => s.clear)
  const faults = useLabStore((s) => s.faults)
  const style = useLabStore((s) => s.settings.wireStyle)
  void style

  const nm = useMemo(() => nodeMap(nodes), [nodes])
  const vis = useWireVisibility(v, nm)
  const live = sim.started ? compute(sim, v, clear, faults) : null
  const hour = (sim.t / 60) % 24
  const day = isDaylight(sim.t)
  const sun = sunDirection(hour)

  const sky = day ? (pal.dark ? '#33496a' : '#cfe3f5') : pal.dark ? '#141b2b' : '#25314a'
  const sunI = day ? 0.6 + 2.2 * Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) * (0.35 + (0.65 * clear) / 100) : 0.12

  const pick = (s: { nodes: string[]; wire: string | null }) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    select(s)
  }

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 18, 45]} />
      <hemisphereLight args={[day ? '#ffffff' : '#8aa0d0', pal.dark ? '#4a4d52' : '#b8b0a8', day ? (pal.dark ? 1.1 : 0.7) : pal.dark ? 0.45 : 0.25]} />
      {/* Dark theme: a soft fill so the darker materials still read; light theme is unchanged. */}
      {pal.dark && <ambientLight intensity={day ? 0.7 : 0.3} />}
      <directionalLight
        position={sun}
        intensity={sunI}
        color={day ? '#fff2dc' : '#9fb4ff'}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <Room env={env} bounds={layout.bounds} pal={pal} day={day} />
      {Object.values(layout.placements)
        .filter((p) => p.bench && env === 'lab')
        .map((p) => (
          <Bench key={'b' + p.id} p={p} pal={pal} />
        ))}
      {nodes.map((n) => {
        const p = layout.placements[n.id]
        const selected = sel.nodes.includes(n.id)
        return (
          <group key={n.id}>
            <Equipment
              node={n}
              p={p}
              selected={selected}
              live={live}
              soc={sim.soc}
              supplied={v.sys.supplied.some((l) => l.id === n.id)}
              pal={pal}
              hover={hoverId === n.id}
              onHover={(h) => setHoverId(h ? n.id : null)}
              onSelect={pick({ nodes: [n.id], wire: null })}
            />
            <Terminals node={n} p={p} showLabels={selected} pal={pal} />
          </group>
        )
      })}
      {wires.map((w, i) => {
        const na = nm[w.a.n]
        const nb = nm[w.b.n]
        if (!na || !nb || vis[w.id] === 'hide') return null
        const a = terminalPos3d(na, w.a.t, layout.placements[na.id])
        const b = terminalPos3d(nb, w.b.t, layout.placements[nb.id])
        const ta = terminal(na, w.a.t)!.t
        const tb = terminal(nb, w.b.t)!.t
        const ty = ta === 'dc' ? tb : ta
        const auto = ty === 'pe' ? 'gy' : TERMINAL_COLOR[ty === 'dc' ? 'dc+' : ty]
        const raw = w.color === 'auto' ? auto : WIRE_COLOR[w.color]
        return (
          <Cable
            key={w.id}
            wire={w}
            points={routed ? routeCable(a, b, (i % 11) - 5, layout) : cablePoints(a, b)}
            routed={routed}
            color={raw === 'gy' ? '#3fae4c' : cssVar(raw)}
            gy={raw === 'gy'}
            fault={!!v.wres[w.id]?.fail && v.wres[w.id].fail!.sev === 'critical'}
            selected={sel.wire === w.id}
            dim={vis[w.id] === 'dim'}
            flow={sel.wire === w.id ? selFlow : null}
            onSelect={pick({ nodes: [], wire: w.id })}
          />
        )
      })}
      {routed && <Trays layout={layout} highUsed={nodes.some((n) => n.type === 'led') && env === 'lab'} pal={pal} />}
      <ContactShadows position={[layout.center[0], 0.005, layout.center[2]]} scale={30} opacity={0.35} blur={2.4} far={6} />
      <CameraRig layout={layout} />
      <WalkControls />
      <LabelProjector anchors={anchors} els={labelEls} />
      <OrbitControls makeDefault target={layout.center} maxPolarAngle={Math.PI / 2.05} minDistance={1.5} maxDistance={60} enableDamping />
    </>
  )
}

export default function Lab3D() {
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const env = useLabStore((s) => s.env3d)
  const setEnv = useLabStore((s) => s.setEnv3d)
  const clearSelection = useLabStore((s) => s.clearSelection)
  const setViewMode = useLabStore((s) => s.setViewMode)
  const v = useValidation()
  const [supported] = useState(hasWebGL)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [cableStyle, setCableStyle] = useState<'routed' | 'direct'>('routed')
  const sel = useLabStore((s) => s.sel)
  const sim = useLabStore((s) => s.sim)
  const clear = useLabStore((s) => s.clear)
  const faults = useLabStore((s) => s.faults)
  const labelEls = useRef(new Map<string, HTMLDivElement>())
  const layout = useMemo(() => layout3d(nodes, env), [nodes, env])
  const live = sim.started ? compute(sim, v, clear, faults) : null
  const connected = new Set(wires.flatMap((w) => [w.a.n + ':' + w.a.t, w.b.n + ':' + w.b.t]))

  const labels: Label[] = []
  for (const n of nodes) {
    const p = layout.placements[n.id]
    if (!p) continue
    const def = CATALOG[n.type]
    const on = sel.nodes.includes(n.id) || hoverId === n.id
    const status = on ? liveStatus(n, live, sim.soc, v.sys.supplied.some((l) => l.id === n.id)) : ''
    labels.push({
      key: n.id,
      at: [p.position[0], p.position[1] + (isPv(n) ? 0.45 : p.size[1] / 2) + 0.12, p.position[2]],
      emphasis: sel.nodes.includes(n.id),
      content: (
        <>
          <span className="mr-1 font-strong">{def.code}</span>
          {on && <span>{nodeTitle(n)}</span>}
          {status && <span className="ml-1.5 text-critical">{status}</span>}
        </>
      ),
    })
    if (sel.nodes.includes(n.id)) {
      for (const [tid, label, type] of def.L.concat(def.R)) {
        const at = terminalPos3d(n, tid, p)
        labels.push({
          key: `${n.id}:${tid}`,
          at: [at[0], at[1] - 0.04, at[2]],
          emphasis: false,
          content: (
            <>
              <span style={{ color: cssVar(TERMINAL_COLOR[type]) }}>■</span> {label}
              {!connected.has(n.id + ':' + tid) && <span className="font-semibold text-muted-foreground"> · {t('open')}</span>}
            </>
          ),
        })
      }
    }
  }

  // Selected cable: label both ends (From → To, following the current when it flows).
  const selWire = sel.wire ? wires.find((w) => w.id === sel.wire) : undefined
  const selFlow = selWire && live ? (wireFlows(nodes, wires, v, live, sim.t, faults)[selWire.id] ?? null) : null
  if (selWire) {
    const ends = selFlow?.dir === -1 ? [selWire.b, selWire.a] : [selWire.a, selWire.b]
    ends.forEach((end, i) => {
      const n = nodes.find((x) => x.id === end.n)
      const p = n && layout.placements[n.id]
      const term = n && terminal(n, end.t)
      if (!n || !p || !term) return
      const at = terminalPos3d(n, end.t, p)
      labels.push({
        key: `wire-end:${i}`,
        at: [at[0], at[1] + 0.09, at[2]],
        emphasis: true,
        content: (
          <>
            <span className="mr-1 font-strong text-primary">{t(i === 0 ? 'From' : 'To')}</span>
            {nodeTitle(n, true)} · <span style={{ color: cssVar(TERMINAL_COLOR[term.t]) }}>■</span> {term.label}
            {i === 0 && selFlow && <span className="ml-1.5 tabular-nums text-muted-foreground">{selFlow.amps.toFixed(2)} A</span>}
          </>
        ),
      })
    })
  }

  if (!supported)
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6">
        <div className="max-w-[380px] edge bg-background p-5">
          <div className="mb-1 font-strong">{t('3D is not available on this device')}</div>
          <p className="mt-0 mb-3 text-muted-foreground">{t('This browser or graphics driver does not support WebGL. The 2D sheet shows the same project, validation and simulation.')}</p>
          <button onClick={() => setViewMode('2d')} className="cursor-pointer edge bg-transparent px-3 py-1.5 font-semibold hover:bg-muted">
            {t('Back to 2D')}
          </button>
        </div>
      </div>
    )


  return (
    // min-w-0 + overflow-hidden let the grid track shrink: the WebGL canvas keeps its last pixel size until R3F re-measures.
    <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-canvas">
      <Canvas shadows dpr={[1, 2]} camera={{ position: framing(layout), fov: 45, near: 0.05, far: 200 }} onPointerMissed={() => clearSelection()} aria-label={t('3D virtual laboratory')}>
        <Scene routed={cableStyle === 'routed'} nodes={nodes} wires={wires} v={v} env={env} layout={layout} hoverId={hoverId} setHoverId={setHoverId} anchors={labels} labelEls={labelEls} selFlow={selFlow} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {labels.map((l) => (
          <div
            key={l.key}
            ref={(el) => {
              if (el) labelEls.current.set(l.key, el)
              else labelEls.current.delete(l.key)
            }}
            className={cn(
              'absolute top-0 left-0 edge bg-background px-1.5 py-0.5 text-[11px] leading-tight font-semibold whitespace-nowrap text-foreground shadow-sm',
              l.key.includes(':') && 'px-1 text-[10px] font-strong',
              l.emphasis && '[border-color:var(--primary)]',
            )}
            style={{ display: 'none' }}
          >
            {l.content}
          </div>
        ))}
      </div>
      <div className="absolute top-2 left-2 flex edge bg-background text-[11px] font-semibold" role="radiogroup" aria-label={t('3D environment')}>
        {(
          [
            ['lab', 'Training laboratory'],
            ['rooftop', 'Residential rooftop'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="radio"
            aria-checked={env === k}
            onClick={() => setEnv(k)}
            className={cn('cursor-pointer border-0 px-2 py-1', env === k ? 'bg-secondary text-active-fg' : 'bg-transparent text-foreground hover:bg-muted')}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="absolute top-2 right-2 flex edge bg-background text-[11px] font-semibold" role="radiogroup" aria-label={t('Cable display')}>
        {(
          [
            ['routed', 'Routed cables'],
            ['direct', 'Direct'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="radio"
            aria-checked={cableStyle === k}
            onClick={() => setCableStyle(k)}
            className={cn('cursor-pointer border-0 px-2 py-1', cableStyle === k ? 'bg-secondary text-active-fg' : 'bg-transparent text-foreground hover:bg-muted')}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <WireFilterNotice v={v} nm={nodeMap(nodes)} className="top-10 bottom-auto" />
      <div className="pointer-events-none absolute bottom-2 left-2 edge bg-background px-2 py-1 text-[11px] text-muted-foreground">
        {t('WASD or arrow keys to walk, Q/E down/up (Shift to run) · drag to orbit · right-drag to pan · scroll to zoom · click a component or cable to inspect · wiring is edited in 2D')}
      </div>
    </div>
  )
}
