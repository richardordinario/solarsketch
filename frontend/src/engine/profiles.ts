/**
 * Equipment profiles: named spec presets for a component type.
 *
 * Two kinds:
 * - EXAMPLE profiles ("Generic") with illustrative values (`example: true`).
 * - DATASHEET profiles for real products sold in the Philippines, with values read from the
 *   manufacturer's datasheet (`source`). See docs/device-datasheets.md. They stay `reviewed: false`
 *   until a person has checked every value against the PDF.
 */
import { CATALOG, LATE_SPECS, makeNode } from './catalog'
import type { ComponentType, LabNode } from './types'

export interface EquipmentProfile {
  id: string
  type: ComponentType
  brand: string
  model: string
  /** Full spec set for the type. */
  specs: Record<string, number>
  /** Profile data version; stored on the instance as `ver`. */
  ver: number
  datasheet: string
  example: boolean
  /** Where a datasheet profile's values came from. */
  source?: { url: string; revision: string; retrieved: string }
  /** True once a person has checked every value against the datasheet. */
  reviewed: boolean
  /** Specs the product lets the installer choose (e.g. 12/24/48 V auto-detect). Any listed value still matches the profile. */
  adjustable?: Record<string, number[]>
  /** Installer settings rather than datasheet values (e.g. battery reserve). Any value still matches the profile. */
  settings?: string[]
  /** Spec keys the datasheet does not publish. They are stored as 0, which the rules treat as "not checked". */
  missing?: string[]
  /** Caveats shown with the profile. */
  notes?: string
}

type ProfileInput = Omit<EquipmentProfile, 'specs' | 'example' | 'reviewed'> & { specs: Partial<Record<string, number>> }

const defaults = (type: ComponentType) => Object.fromEntries(CATALOG[type].specs.map((s) => [s[0], s[3]])) as Record<string, number>

const make = (p: ProfileInput): EquipmentProfile => ({ ...p, specs: { ...defaults(p.type), ...p.specs } as Record<string, number>, example: true, reviewed: false })

const RETRIEVED = '2026-11-08'

/** A real product. Every spec key must be given (no catalog defaults), so nothing is silently invented. */
const real = (p: Omit<ProfileInput, 'datasheet' | 'source' | 'ver'> & { specs: Record<string, number>; url: string; revision: string }): EquipmentProfile => {
  const { url, revision, ...rest } = p
  return { ...withLateSpecs(rest), ver: 1, datasheet: `${p.brand} datasheet, ${revision}`, source: { url, revision, retrieved: RETRIEVED }, example: false, reviewed: false }
}

/**
 * Spec keys added in rule set 1.4.0 (LATE_SPECS). When a real profile does not give one, an
 * installer setting takes the catalog default and is listed in `settings`; a datasheet value is
 * stored as 0 and listed in `missing`, so nothing is invented. Given settings are listed too.
 */
export function withLateSpecs<T extends { type: ComponentType; specs: Record<string, number>; missing?: string[]; settings?: string[] }>(p: T): T {
  const specs = { ...p.specs }
  const missing = [...(p.missing ?? [])]
  const settings = [...(p.settings ?? [])]
  for (const [key, , , value] of CATALOG[p.type].specs) {
    const kind = LATE_SPECS[key]
    if (!kind) continue
    if (kind === 'setting' && !settings.includes(key)) settings.push(key)
    if (key in specs) continue
    if (kind === 'setting') specs[key] = value
    else {
      specs[key] = 0
      if (!missing.includes(key)) missing.push(key)
    }
  }
  return { ...p, specs, ...(missing.length ? { missing } : {}), ...(settings.length ? { settings } : {}) }
}

export const PROFILES: EquipmentProfile[] = [
  make({ id: 'pv-generic-400', type: 'pv', brand: 'Generic', model: '400 W mono (catalog default)', specs: {}, ver: 3, datasheet: 'Example values' }),
  make({ id: 'pv-generic-450', type: 'pv', brand: 'Generic', model: '450 W mono half-cell', specs: { ratedPower: 450, voc: 49.8, vmp: 41.6, isc: 11.5 }, ver: 1, datasheet: 'Example values' }),
  make({ id: 'pv-generic-550', type: 'pv', brand: 'Generic', model: '550 W mono half-cell', specs: { ratedPower: 550, voc: 49.6, vmp: 41.9, isc: 14.0 }, ver: 1, datasheet: 'Example values' }),

  make({ id: 'mppt-generic-60-150', type: 'mppt', brand: 'Generic', model: 'MPPT 60 A · 150 V (catalog default)', specs: {}, ver: 3, datasheet: 'Example values' }),
  make({ id: 'mppt-generic-40-100', type: 'mppt', brand: 'Generic', model: 'MPPT 40 A · 100 V', specs: { maxPvV: 100, maxPvI: 30, maxI: 40 }, ver: 1, datasheet: 'Example values' }),
  make({ id: 'mppt-generic-100-250', type: 'mppt', brand: 'Generic', model: 'MPPT 100 A · 250 V · 48 V system', specs: { maxPvV: 250, maxPvI: 70, maxI: 100, nomV: 48, eff: 98 }, ver: 1, datasheet: 'Example values' }),

  make({ id: 'pwm-generic-30', type: 'pwm', brand: 'Generic', model: 'PWM 30 A (catalog default)', specs: {}, ver: 2, datasheet: 'Example values' }),
  make({ id: 'pwm-generic-20', type: 'pwm', brand: 'Generic', model: 'PWM 20 A', specs: { maxPvI: 20, maxI: 20 }, ver: 1, datasheet: 'Example values' }),

  make({ id: 'bat-generic-24-200', type: 'bat', brand: 'Generic', model: 'LiFePO4 25.6 V 200 Ah (catalog default)', specs: {}, ver: 4, datasheet: 'Example values' }),
  make({ id: 'bat-generic-24-100', type: 'bat', brand: 'Generic', model: 'LiFePO4 25.6 V 100 Ah', specs: { ah: 100, maxC: 50, maxD: 100 }, ver: 1, datasheet: 'Example values' }),
  make({ id: 'bat-generic-12-100', type: 'bat', brand: 'Generic', model: 'LiFePO4 12.8 V 100 Ah', specs: { nomV: 12.8, ah: 100, maxC: 50, maxD: 100 }, ver: 1, datasheet: 'Example values' }),
  make({ id: 'bat-generic-48-100', type: 'bat', brand: 'Generic', model: 'LiFePO4 51.2 V 100 Ah', specs: { nomV: 51.2, ah: 100, maxC: 50, maxD: 100 }, ver: 1, datasheet: 'Example values' }),

  make({ id: 'inv-generic-3000-24', type: 'inv', brand: 'Generic', model: 'Off-grid 3 kW · 24 V (catalog default)', specs: {}, ver: 2, datasheet: 'Example values' }),
  make({ id: 'inv-generic-1500-24', type: 'inv', brand: 'Generic', model: 'Off-grid 1.5 kW · 24 V', specs: { ratedP: 1500, eff: 92, surgeP: 3000 }, ver: 1, datasheet: 'Example values' }),
  make({ id: 'inv-generic-5000-48', type: 'inv', brand: 'Generic', model: 'Off-grid 5 kW · 48 V', specs: { nomV: 48, ratedP: 5000, eff: 94, surgeP: 10000, minDcV: 42, maxDcV: 64, lvd: 50, lvr: 51.2 }, ver: 1, datasheet: 'Example values' }),

  make({ id: 'dcb-generic-63', type: 'dcb', brand: 'Generic', model: 'DC breaker 2P 63 A (catalog default)', specs: {}, ver: 1, datasheet: 'Example values' }),
  make({ id: 'dcb-generic-125', type: 'dcb', brand: 'Generic', model: 'DC breaker 2P 125 A · 150 V', specs: { ratedI: 125, maxV: 150 }, ver: 1, datasheet: 'Example values' }),
  make({ id: 'dcb-generic-32', type: 'dcb', brand: 'Generic', model: 'DC breaker 2P 32 A', specs: { ratedI: 32 }, ver: 1, datasheet: 'Example values' }),

  // --- Datasheet profiles (PH market, unreviewed). Values: STC for PV; see docs/device-datasheets.md. ---

  real({ id: 'pv-jinko-jkm580n-72hl4-bdv', type: 'pv', brand: 'Jinko Solar', model: 'Tiger Neo JKM580N-72HL4-BDV', specs: { ratedPower: 580, voc: 51.47, vmp: 42.59, isc: 14.37 }, revision: 'JKM560-580N-72HL4-BDV-F3-EN', url: 'https://jinkosolarcdn.shwebspace.com/uploads/JKM560-580N-72HL4-BDV-F3-EN.pdf' }),
  real({ id: 'pv-longi-lr5-54hth-430m', type: 'pv', brand: 'LONGi', model: 'Hi-MO 6 Explorer LR5-54HTH-430M', specs: { ratedPower: 430, voc: 39.13, vmp: 32.84, isc: 14.15 }, revision: '20230926V19', url: 'https://static.longi.com/L_Gi_LE_PM_T_PMD_059_F130_LR_5_54_HTH_420_440_M_V1_30_30_and_15_Frame_Explorer_V19_96aefb02d4.pdf' }),
  real({ id: 'pv-ja-jam72s30-550-mr', type: 'pv', brand: 'JA Solar', model: 'DeepBlue 3.0 JAM72S30-550/MR', specs: { ratedPower: 550, voc: 49.9, vmp: 41.96, isc: 14.0 }, revision: 'Global_EN_20220921A', url: 'https://www.jasolar.com/uploadfile/2022/0928/20220928044146849.pdf' }),
  real({ id: 'pv-canadian-cs6w-550ms', type: 'pv', brand: 'Canadian Solar', model: 'HiKu6 CS6W-550MS', specs: { ratedPower: 550, voc: 49.6, vmp: 41.7, isc: 14.0 }, revision: 'v2.9 (AU), Jul 2024', url: 'https://static.csisolar.com/wp-content/uploads/2024/07/23145733/CS-Datasheet-HiKu6_CS6W-MS_v2.9_EN.pdf' }),
  real({ id: 'pv-trina-tsm-440neg9r28', type: 'pv', brand: 'Trina Solar', model: 'Vertex S+ TSM-440NEG9R.28', specs: { ratedPower: 440, voc: 52.2, vmp: 44.0, isc: 10.67 }, revision: 'TSM_EN_2024_C', url: 'https://vertexsplus.trinasolar.com/wp-content/uploads/2024/09/240831_Datasheet_Vertex-S_NEG9R.28_EN_2024_C_web.pdf' }),
  real({ id: 'pv-trina-tsm-600neg19rc20', type: 'pv', brand: 'Trina Solar', model: 'Vertex N TSM-600NEG19RC.20', specs: { ratedPower: 600, voc: 48.4, vmp: 40.3, isc: 15.8 }, revision: 'TSM_EN_2023_PA2', url: 'https://pages.trinasolar.com/rs/567-KJK-096/images/Datasheet_Vertex_NEG19RC.20_EN_2023.pdf' }),

  real({ id: 'mppt-victron-smartsolar-150-35', type: 'mppt', brand: 'Victron Energy', model: 'SmartSolar MPPT 150/35', specs: { maxPvV: 150, maxPvI: 40, maxI: 35, nomV: 24, eff: 98 }, adjustable: { nomV: [12, 24, 36, 48] }, notes: 'Max PV input current is the short-circuit limit. 36 V needs the VictronConnect app.', revision: 'no printed revision (PDF 2022-09-14)', url: 'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-150-35-EN.pdf' }),
  real({ id: 'mppt-epever-tracer3210an-g3', type: 'mppt', brand: 'EPEVER', model: 'Tracer3210AN G3', specs: { maxPvV: 100, maxPvI: 30, maxI: 30, nomV: 24, eff: 98 }, adjustable: { nomV: [12, 24] }, notes: 'Max PV voltage is the limit at minimum temperature (92 V at 25 °C).', revision: 'Manual V2.4', url: 'https://www.epever.com/wp-content/uploads/2024/08/Tracer-AN-G3-Manual-EN-V2.4.pdf' }),
  real({ id: 'mppt-epever-xtra4415n', type: 'mppt', brand: 'EPEVER', model: 'XTRA4415N', specs: { maxPvV: 150, maxPvI: 40, maxI: 40, nomV: 48, eff: 98.5 }, adjustable: { nomV: [12, 24, 36, 48] }, notes: 'Max PV voltage is the limit at minimum temperature (138 V at 25 °C).', revision: 'Manual V1.3', url: 'https://www.epever.com/upload/file/1811/XTRA-SMS-EL-V1.3.pdf' }),
  real({ id: 'mppt-srne-ml2440', type: 'mppt', brand: 'SRNE', model: 'ML2440', specs: { maxPvV: 100, maxPvI: 0, maxI: 40, nomV: 24, eff: 98 }, adjustable: { nomV: [12, 24] }, missing: ['maxPvI'], revision: 'Datasheet V1.2', url: 'https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_ML%20series_24V_20~40A_Solar%20Charge%20Controller_datasheet_V1.2.pdf' }),
  real({ id: 'mppt-srne-mc4860n15', type: 'mppt', brand: 'SRNE', model: 'MC4860N15', specs: { maxPvV: 150, maxPvI: 50, maxI: 60, nomV: 48, eff: 98 }, adjustable: { nomV: [12, 24, 36, 48] }, notes: 'Max PV input current is the short-circuit limit (from the manual).', revision: 'Datasheet 1.1', url: 'https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_MC%20series_48V_60~70A_Solar%20Charge%20Controller_datasheet_1.1.pdf' }),

  real({ id: 'bat-powmr-pow-100ah-12v8', type: 'bat', brand: 'PowMr', model: 'POW-100AH-12.8V', specs: { nomV: 12.8, ah: 100, maxC: 100, maxD: 100 }, revision: 'spec sheet (no printed revision)', url: 'https://cdn.shopify.com/s/files/1/0746/0415/1079/files/PowMr_POW-100AH-12.8V_LiFePO4_Battery_Specification_Sheet_dd924441-3823-4b0d-85bb-7e1921140ad3.pdf?v=1783672150' }),
  real({ id: 'bat-powmr-pow-100ah-25v6', type: 'bat', brand: 'PowMr', model: 'POW-100AH-25.6V', specs: { nomV: 25.6, ah: 100, maxC: 100, maxD: 100 }, revision: 'spec sheet (no printed revision)', url: 'https://cdn.shopify.com/s/files/1/0746/0415/1079/files/PowMr_POW-100AH-25.6V_LiFePO4_Battery_Specification_Sheet_082a3087-6f8c-4fc5-9e93-c5f446028bab.pdf?v=1783672181' }),
  real({ id: 'bat-pylontech-us5000', type: 'bat', brand: 'Pylontech', model: 'US5000', specs: { nomV: 48, ah: 100, maxC: 100, maxD: 100 }, notes: 'Capacity is derived (4800 Wh ÷ 48 V); the datasheet gives energy only. Recommended current is 80 A.', revision: 'Manual 5PMPA08-00219 V1.0', url: 'https://global-site.oss-eu-central-1.aliyuncs.com/upload/2024/09/25/RESS-Installation%20Manual-US5000%20US5000-B%205PMPA08-00219_V1.0_20240925124144A058.pdf' }),
  real({ id: 'bat-dyness-dl5-0c', type: 'bat', brand: 'Dyness', model: 'DL5.0C', specs: { nomV: 51.2, ah: 100, maxC: 75, maxD: 100 }, notes: 'Recommended charge and discharge current is 50 A.', revision: '20250701-EN', url: 'https://apac.dyness.com/Public/Uploads/uploadfile/files/20250909/DL5.0CDatasheetEN20250701.pdf' }),
  real({ id: 'bat-deye-se-g5-1-pro-b', type: 'bat', brand: 'Deye', model: 'SE-G5.1 Pro-B', specs: { nomV: 51.2, ah: 100, maxC: 100, maxD: 100 }, notes: 'Recommended charge and discharge current is 50 A.', revision: 'Brochure V1.0 (2026-09-07)', url: 'https://deye.com/wp-content/uploads/2026/09/deye-se-g5.1-pro-b-series_brochure_20260907v1.0.pdf' }),

  real({ id: 'inv-victron-multiplus-ii-24-3000', type: 'inv', brand: 'Victron Energy', model: 'MultiPlus-II 24/3000/70-32 230V', specs: { nomV: 24, ratedP: 2400, eff: 94, acV: 230, surgeP: 5500, minDcV: 19, maxDcV: 33 }, notes: 'Rated 3000 VA / 2400 W at 25 °C. Ships at 50 Hz; set it to 60 Hz for the Philippines.', revision: 'no printed revision', url: 'https://www.victronenergy.com/upload/documents/Datasheet-MultiPlus-II-inverter-charger-EN.pdf' }),
  real({ id: 'inv-victron-multiplus-ii-48-5000', type: 'inv', brand: 'Victron Energy', model: 'MultiPlus-II 48/5000/70-50 230V', specs: { nomV: 48, ratedP: 4000, eff: 96, acV: 230, surgeP: 9000, minDcV: 38, maxDcV: 66, lvd: 50, lvr: 51.2 }, notes: 'Rated 5000 VA / 4000 W at 25 °C. Ships at 50 Hz; set it to 60 Hz for the Philippines.', revision: 'no printed revision', url: 'https://www.victronenergy.com/upload/documents/Datasheet-MultiPlus-II-inverter-charger-EN.pdf' }),

  // Hybrid / all-in-one units. Battery reserve and export limit are installer settings, not datasheet values.
  real({ id: 'hyb-deye-sun-3k-sg04lp1-24', type: 'hyb', brand: 'Deye', model: 'SUN-3K-SG04LP1-24-EU', specs: { ratedP: 3000, nomV: 24, maxPvV: 500, maxPvI: 13, maxI: 140, eff: 97.6, acV: 230, reserveSoc: 30, exportLimit: 3000, surgeP: 6000 }, settings: ['reserveSoc', 'exportLimit'], notes: 'Efficiency is probably PV-to-AC. The EU datasheet lists no Philippine grid approval.', revision: 'SG04LP1 datasheet, no printed revision (distributor-hosted copy)', url: 'https://techstore-lb.com/wp-content/uploads/2024/01/deye-6kw-04.pdf' }),
  real({ id: 'hyb-deye-sun-5k-sg04lp1', type: 'hyb', brand: 'Deye', model: 'SUN-5K-SG04LP1-EU', specs: { ratedP: 5000, nomV: 48, maxPvV: 500, maxPvI: 13, maxI: 120, eff: 97.6, acV: 230, reserveSoc: 30, exportLimit: 5000, surgeP: 10000 }, settings: ['reserveSoc', 'exportLimit'], notes: 'Two MPPT inputs of 13 A each; the lab models one PV input. Efficiency is probably PV-to-AC. The EU datasheet lists no Philippine grid approval.', revision: 'SG04LP1 datasheet, no printed revision (distributor-hosted copy)', url: 'https://techstore-lb.com/wp-content/uploads/2024/01/deye-6kw-04.pdf' }),
  real({ id: 'hyb-srne-hf2430s80-h', type: 'hyb', brand: 'SRNE', model: 'HF2430S80-H', specs: { ratedP: 3300, nomV: 24, maxPvV: 500, maxPvI: 13, maxI: 80, eff: 92, acV: 230, reserveSoc: 30, exportLimit: 0, surgeP: 6000 }, settings: ['reserveSoc'], notes: 'Off-grid all-in-one: the AC input charges and bypasses but never exports, so the export limit is 0. Efficiency is battery-to-AC. Max charge current is from the MPPT (80 A from AC). Surge is 6000 VA, taken as W.', revision: 'HF series HV EU datasheet', url: 'https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_HF%20series_HV_EU_solar%20charge%20inverter_datasheet_2(1).pdf' }),
  real({ id: 'hyb-srne-hf4850s80-h', type: 'hyb', brand: 'SRNE', model: 'HF4850S80-H', specs: { ratedP: 5000, nomV: 48, maxPvV: 500, maxPvI: 18, maxI: 80, eff: 92, acV: 230, reserveSoc: 30, exportLimit: 0, surgeP: 10000 }, settings: ['reserveSoc'], notes: 'Off-grid all-in-one: the AC input charges and bypasses but never exports, so the export limit is 0. Efficiency is battery-to-AC. Max charge current is from the MPPT (60 A from AC). Surge is 10000 VA, taken as W.', revision: 'HF series HV EU datasheet', url: 'https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_HF%20series_HV_EU_solar%20charge%20inverter_datasheet_2(1).pdf' }),
]

/** Profiles from catalogs the user imported (engine/catalog-import.ts), set at boot and on change. */
let userProfiles: EquipmentProfile[] = []
export function setUserProfiles(list: EquipmentProfile[]) {
  userProfiles = list
}
const allProfiles = () => (userProfiles.length ? PROFILES.concat(userProfiles) : PROFILES)

export const profilesFor = (type: ComponentType) => allProfiles().filter((p) => p.type === type)
export const profileById = (id: string | undefined) => (id ? allProfiles().find((p) => p.id === id) : undefined)

/** True when the instance's specs still equal the profile's (adjustable specs may take any listed value). */
export function matchesProfile(specs: Record<string, number>, profile: EquipmentProfile) {
  return Object.entries(profile.specs).every(([k, v]) => specs[k] === v || !!profile.adjustable?.[k]?.includes(specs[k]) || !!profile.settings?.includes(k))
}

/** The specs to apply for a profile, keeping the component's current choice for adjustable specs. */
export function profileSpecs(profile: EquipmentProfile, current: Record<string, number>) {
  const specs = { ...profile.specs }
  for (const [k, allowed] of Object.entries(profile.adjustable ?? {})) if (allowed.includes(current[k])) specs[k] = current[k]
  for (const k of profile.settings ?? []) if (k in current) specs[k] = current[k]
  return specs
}

/** Real products (built-in datasheet profiles and imported catalogs), shown as their own library items. */
export const deviceProfiles = () => allProfiles().filter((p) => !p.example)

/** A new component instance carrying a device profile's specs. */
export function makeDeviceNode(profile: EquipmentProfile, x: number, y: number): LabNode {
  const node = makeNode(profile.type, x, y)
  // Catalog defaults fill keys an older imported catalog lacks; the profile's values win.
  return { ...node, specs: { ...node.specs, ...profile.specs }, ver: profile.ver, profile: profile.id }
}

/** Display name: the product for a device component, otherwise the catalog name. `short` drops the brand (canvas nodes). */
export function nodeTitle(node: LabNode, short = false) {
  const p = profileById(node.profile)
  if (!p || p.example) return CATALOG[node.type].name
  return short ? p.model : `${p.brand} ${p.model}`
}
