/** Maps lesson media ids (content/lessons.ts) to their renderers, so tsc enforces that every id has one. */
import type { ReactElement } from 'react'

import type { IllustrationId, WidgetId } from '@/content/lessons'
import type { ComponentType } from '@/engine/types'
import { href } from '@/lib/router'

import * as I from './illustrations'
import * as W from './widgets'

export const ILLUSTRATIONS: Record<IllustrationId, (props: { label: string }) => ReactElement> = {
  'pv-hierarchy': I.PvHierarchy,
  'circuit-basics': I.CircuitBasics,
  'ac-dc': I.AcDc,
  'shading-bypass': I.ShadingBypass,
  'series-parallel': I.SeriesParallel,
  'battery-bank': I.BatteryBank,
  'system-types': I.SystemTypes,
  'protection-map': I.ProtectionMap,
  'rcd-principle': I.RcdPrinciple,
  'voltage-drop': I.VoltageDrop,
  earthing: I.Earthing,
  'single-line': I.SingleLine,
  'multi-mppt': I.MultiMppt,
  'generator-ats': I.GeneratorAts,
  'energy-day': I.EnergyDay,
}

export const WIDGETS: Record<WidgetId, () => ReactElement> = {
  'pv-output': W.PvOutput,
  'power-energy': W.PowerEnergy,
  'string-calc': W.StringCalc,
  'battery-calc': W.BatteryCalc,
  'voltage-drop': W.VoltageDropCalc,
  'load-sizing': W.LoadSizing,
}

/** Link to a component's card on the Components page. */
export const componentHref = (type: ComponentType) => href({ page: 'components', type })
