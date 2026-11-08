/**
 * Illustrative photos for the generic catalog components, from Wikimedia Commons (or another
 * open-licence source such as Flickr via Openverse) under open licences (public domain, CC0, CC BY, CC BY-SA). Stored in public/components/. CC BY and
 * CC BY-SA require crediting the author and licence and saying whether the image was changed,
 * so every place that shows a photo also shows its credit.
 */
import type { ComponentType } from './types'

export interface ComponentImage {
  /** Path under the site base, e.g. "components/pv.jpg". */
  file: string
  /** Source page of the photo. */
  filePage: string
  /** Where it was published; Wikimedia Commons when omitted. */
  source?: string
  author: string
  license: string
  licenseUrl?: string
  /** Cropped or otherwise edited from the original. */
  modified: boolean
}

export const COMPONENT_IMAGES: Partial<Record<ComponentType, ComponentImage>> = {
  pv: { file: 'components/pv.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Monocrystalline_silicon_solar_panel.jpg', author: 'ArticCynda', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modified: true },
  mppt: { file: 'components/mppt.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Amsterdam_RAI_METS_2011_(146).JPG', author: 'S.J. de Waard', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: true },
  pwm: { file: 'components/pwm.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Kabus_000245_171295_516064_4578_(36775931446).jpg', author: 'Cody Kabus, U.S. Department of Energy', license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', modified: true },
  bat: { file: 'components/bat.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Akumulator_LiFePo4_firmy_KonTec.webp', author: 'Martinosv', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  dcb: { file: 'components/dcb.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Solar_combiner_box.jpg', author: 'cocreatr', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', modified: true },
  inv: { file: 'components/inv.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Mastervolt_AC_Master_24-300_sine_wave_inverter.JPG', author: 'S.J. de Waard', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  gti: { file: 'components/gti.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Sunsathi_inverter.jpg', author: 'Sunsathisolar', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modified: true },
  hyb: { file: 'components/hyb.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Onduleur_hybride.jpg', author: 'mobius', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: true },
  outlet: { file: 'components/outlet.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Electrical_Outlet_1_2017-04-05.jpg', author: 'Fastily', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', modified: true },
  acdb: { file: 'components/acdb.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Eaton_circuit_breaker_panel_open.JPG', author: 'BrokenSphere', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: true },
  grid: { file: 'components/grid.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:0016jfjfEDSA_Taft_Avenue_MRT_Station_LRT_Footbridge_Pasay_Cityfvf_14.jpg', author: 'Judgefloro', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', modified: false },
  nm: { file: 'components/nm.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Smart_Meter_(10945291434).jpg', author: 'National Institute of Standards and Technology', license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', modified: true },
  gen: { file: 'components/gen.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Portable_electrical_generator_side.jpg', author: 'Gbleem (English Wikipedia user)', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', modified: true },
  ats: { file: 'components/ats.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Generator_Transfer_Switch.jpg', author: 'Robert.Harker', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  led: { file: 'components/led.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:LED_bulb_800_Lm_Soft_white_2024.agr.jpg', author: 'ArnoldReinhold', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', modified: false },
  fan: { file: 'components/fan.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Floor_fan.jpg', author: 'Hans Olav Lien', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  fridge: { file: 'components/fridge.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:US_Domestic_Refrigerator_-_Frigidaire.jpg', author: 'Infrogmation of New Orleans', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: true },
  tv: { file: 'components/tv.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Mirai_LCD_TV.JPG', author: 'CHG', license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', modified: true },
  acw: { file: 'components/acw.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Air_Condition_Unit_Interior_View_USA.jpg', author: 'Stilfehler', license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', modified: false },
  acs: { file: 'components/acs.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Wall-mount_AC.jpg', author: 'Douglas Paul Perkins', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  pc: { file: 'components/pc.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Desktop_workspace_in_transition_2008.jpg', author: 'Dennis Hamilton', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', modified: false },
  laptop: { file: 'components/laptop.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Lenovo_G500s_laptop-2903.jpg', author: 'Raimond Spekking', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  router: { file: 'components/router.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg', author: 'Syced', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modified: false },
  rice: { file: 'components/rice.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Rice-cooker.jpg', author: 'Aarchiba (background removed by Rama)', license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', modified: false },
  kettle: { file: 'components/kettle.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:2023_Czajnik_elektryczny_Bosch_(1).jpg', author: 'Jacek Halicki', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  micro: { file: 'components/micro.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Panasonic_MICROWAVE_OVEN_NN-GM333W.jpg', author: 'Dinkun Chen', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  induc: { file: 'components/induc.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Eupa_TSI-IH1880.jpg', author: 'Qurren', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  wash: { file: 'components/wash.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Frigidaire_FAW-0351MT_semi-automatic_washing_machine.jpg', author: 'Mk2010', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  iron: { file: 'components/iron.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Philips_steam_iron_model_HD_1256_A.jpg', author: 'Peter Häll', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modified: false },
  // PV variants and battery chemistries.
  pvpoly: { file: 'components/pvpoly.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Polycrystalline_solar_panel_mj1.jpg', author: 'Mariojan photo', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  pvbif: { file: 'components/pvbif.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Next2Sun_Anlagenkonzept.jpg', author: 'Jana309', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  pvflex: { file: 'components/pvflex.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Dornbirn-Fexible_solar_panel_18Wp-03ASD.jpg', author: 'Asurnipal', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  pvport: { file: 'components/pvport.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Portable_solar_panel.jpg', author: 'Tiia Monto', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  batfla: { file: 'components/batfla.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Super_Start_Marine_RV_Deep_Cycle_Battery.jpg', author: 'TaurusEmerald', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  batagm: { file: 'components/batagm.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:VRLA_Valve-Regulated-Lead-Acid-Batteries_82645.jpg', author: 'Emilian Robert Vicol', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', modified: false },
  batgel: { file: 'components/batgel.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:DryfitA300Blei-Gel-Akkumulator.jpeg', author: 'Giselher Nitz', license: 'CC BY-SA 3.0 DE', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/de/deed.en', modified: false },
  batnmc: { file: 'components/batnmc.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Lithium-Ion_Battery_for_BMW_i3_-_Battery_Pack.JPG', author: 'RudolfSimon', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  // Inline devices (connectors, protection, distribution, measurement, microinverter).
  mc4: { file: 'components/mc4.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:MC4_Connector.jpg', author: '2Inchs', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  cbx: { file: 'components/cbx.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Solar_combiner_box.jpg', author: 'cocreatr', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', modified: true },
  fuse: { file: 'components/fuse.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Fuse_100A_with_holder,_closed.jpg', author: 'Zureks', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', modified: false },
  iso: { file: 'components/iso.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Main_battery_switches_in_a_sailboat.jpg', author: 'PaterMcFly', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', modified: false },
  dspd: { file: 'components/dspd.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:%C3%9Cberspannungsschutz-PV-Anlage.jpg', author: 'Asurnipal', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: true },
  mcb: { file: 'components/mcb.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Circuit_breaker_2_pole_on_DIN_rail.JPG', author: 'Kae', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  mccb: { file: 'components/mccb.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:MCCB_Merlin_Gerin_compact_NS100N_(front_side).jpg', author: 'Pui108108', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', modified: false },
  rccb: { file: 'components/rccb.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Residual_current_device_(RCD).jpg', author: 'Diermaier', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modified: false },
  aspd: { file: 'components/aspd.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:SwitchboardSurgeProtector-40kA-DinRail.jpg', author: 'JoanTheSpark', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', modified: false },
  acsw: { file: 'components/acsw.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Electrical_Isolator.jpg', author: 'Balurbala', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', modified: false },
  dbus: { file: 'components/dbus.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Busbars.jpg', author: 'Ali@gwc.org.uk', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', modified: false },
  pebar: { file: 'components/pebar.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Potentialausgleichsschiene_unbeschaltet.jpg', author: 'Uwe Schwöbel', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', modified: false },
  dcm: { file: 'components/dcm.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Shunt_resistor.JPG', author: 'Berlin.karajan', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
  acm: { file: 'components/acm.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:Energy_meters.jpg', author: 'Acrel electric', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: true },
  mi: { file: 'components/mi.jpg', filePage: 'https://commons.wikimedia.org/wiki/File:2025-09-08_BalconySolar_Micro_Inverter_Bremen(state).jpg', author: 'Michael32710', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', modified: false },
}

export const componentImage = (type: ComponentType) => COMPONENT_IMAGES[type]
