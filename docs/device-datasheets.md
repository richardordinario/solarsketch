# Device datasheet research (PH market)

Collected 2026-11-08 for replacing the "Generic" example profiles in `frontend/src/engine/profiles.ts` with real devices.

**Status: unreviewed.** Every value was read from a manufacturer datasheet or manual (URLs below). Nothing was filled from memory, and anything that couldn't be confirmed is marked "not found". A person still has to check the values against the PDFs before any profile is marked `example: false`.

**Encoded in `engine/profiles.ts`** (`example: false`, `reviewed: false`): the 6 PV modules, all 5 MPPT controllers, all 5 batteries, both Victron MultiPlus-II inverters, and four hybrid units on the `hyb` type (Deye SUN-3K-SG04LP1-24, Deye SUN-5K-SG04LP1, SRNE HF2430S80-H, SRNE HF4850S80-H). They appear in the Virtual Lab under Component Library → Real devices. On the hybrids, `reserveSoc` (and `exportLimit` on Deye) are installer settings, not datasheet values. The SRNE HF units are off-grid all-in-ones, so their `exportLimit` is 0. Deye has two 13 A MPPT inputs, but the lab models one. Left out:
- EPEVER LS2024B: max PV current and efficiency not published.
- Must EP3000 PLUS: incomplete data.
- Growatt SPF 5000 ES: max PV input current not published (2019 sheet).

When a profile has been checked against its PDF, set `reviewed: true`.

PH popularity is based on qualitative evidence: PH guide sites, Lazada PH listings, and the manufacturers' own PH distributor pages. No sales or market-share data was found. Each section notes how strong its evidence is.

---

## 1. PV modules

All values are STC, front side, for one power bin per model.

| Brand / model (bin) | Type | Pmax W | Voc V | Vmp V | Isc A | Imp A | TC Voc %/°C | TC Pmax %/°C | Max sys V | Max fuse A | Revision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Jinko Tiger Neo JKM580N-72HL4-BDV | N-TOPCon bifacial | 580 | 51.47 | 42.59 | 14.37 | 13.62 | -0.25 | -0.30 | 1500 | 30 | F3-EN, ©2022 |
| LONGi Hi-MO 6 Explorer LR5-54HTH-430M | N-type HPBC | 430 | 39.13 | 32.84 | 14.15 | 13.10 | -0.230 | -0.290 | 1500 | 25 | 20230926V19 |
| JA Solar DeepBlue 3.0 JAM72S30-550/MR | Mono PERC | 550 | 49.90 | 41.96 | 14.00 | 13.11 | -0.275 | -0.350 | 1500 | 25 | Global_EN_20220921A |
| Canadian Solar HiKu6 CS6W-550MS | Mono PERC | 550 | 49.6 | 41.7 | 14.00 | 13.20 | -0.26 | -0.34 | 1500 / 1000 variant | 25 | V2.9_AU, Jul 2024 |
| Trina Vertex S+ TSM-440NEG9R.28 | N i-TOPCon dual glass | 440 | 52.2 | 44.0 | 10.67 | 10.01 | -0.24 | -0.29 | 1500 | 25 | TSM_EN_2024_C |
| Trina Vertex N TSM-600NEG19RC.20 | N i-TOPCon bifacial | 600 | 48.4 | 40.3 | 15.80 | 14.91 | -0.24 | -0.30 | 1500 | 35 | TSM_EN_2023_PA2 |

Sources:
- Jinko: https://jinkosolarcdn.shwebspace.com/uploads/JKM560-580N-72HL4-BDV-F3-EN.pdf (Jinko CDN; no longer linked from the current download page)
- LONGi: https://static.longi.com/L_Gi_LE_PM_T_PMD_059_F130_LR_5_54_HTH_420_440_M_V1_30_30_and_15_Frame_Explorer_V19_96aefb02d4.pdf
  - PH listings often mean the 72-cell Hi-MO 5 (LR5-72HPH) at 550 W, but no official PDF was found for it.
- JA Solar: https://www.jasolar.com/uploadfile/2022/0928/20220928044146849.pdf (the numbers are drawn as vector shapes, so they were read from a render of the page)
- Canadian Solar: https://static.csisolar.com/wp-content/uploads/2024/07/23145733/CS-Datasheet-HiKu6_CS6W-MS_v2.9_EN.pdf (the footer says AU version)
- Trina S+: https://vertexsplus.trinasolar.com/wp-content/uploads/2024/09/240831_Datasheet_Vertex-S_NEG9R.28_EN_2024_C_web.pdf
- Trina N: https://pages.trinasolar.com/rs/567-KJK-096/images/Datasheet_Vertex_NEG19RC.20_EN_2023.pdf

Popularity evidence (moderate):
- pinas.solar best-panels guide
- lakasolar.ph brand list
- watt-attack.com PH prices
- Lazada PH listings for Jinko Tiger Neo, Trina TOPCon, Canadian, JA and LONGi
- Risen was dropped because no official English datasheet was found.

## 2. Charge controllers

| Model | Type | maxPvV (Voc) | MPPT range | maxPvI A | maxI A | nomV | eff | Max PV W per battery V | Revision |
|---|---|---|---|---|---|---|---|---|---|
| Victron SmartSolar MPPT 150/35 | MPPT | 150 abs (145 start/operate) | start needs Vbat+5 V | 40 (Isc) | 35 | 12/24/48 (36 via software) | 98 | 500/1000/1500/2000 "nominal" | no rev; PDF 2022-09-14 |
| EPEVER Tracer3210AN G3 | MPPT | 100 @ min temp, 92 @ 25 °C | Vbat+2 to 72 V | 30 | 30 | 12/24 | 98 (series max) | 390/780 | manual V2.4 |
| EPEVER XTRA4415N | MPPT | 150 @ min temp, 138 @ 25 °C | Vbat+2 to 108 V | 40 | 40 | 12/24/36/48 | 98.5 max, 97.2 full load | 520/1040/1560/2080 | manual V1.3 |
| SRNE ML2440 | MPPT | 100 (90 @ -25 °C per manual) | Vbat+2 to 75 V | not found | 40 | 12/24 | ≤98 conversion | 550/1100 | DS V1.2, manual V1.06 |
| SRNE MC4860N15 | MPPT | 150 | Vbat+2 to 110 V | 50 (Isc) | 60 | 12/24/36/48 | ≤98 conversion | 800/1600/2400/3200 | DS 1.1, manual V1.03 |
| EPEVER LandStar LS2024B | PWM | 50 | n/a | not found | 20 | 12/24 | not found | not found | no rev |

Notes:
- **Grounding:** LS2024B is common positive; Tracer AN G3 and XTRA are common negative. This should become a per-model attribute.
- **Two Voc limits:** EPEVER and SRNE print one at minimum temperature and one at 25 °C. Store both.
- **Efficiency:** use the conversion figure (≤98 %), not the MPPT tracking figure (>99 %).

Sources:
- Victron: https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-150-35-EN.pdf
- EPEVER Tracer AN G3: https://www.epever.com/wp-content/uploads/2024/08/Tracer-AN-G3-Manual-EN-V2.4.pdf
- EPEVER XTRA:
  - Datasheet: https://www.epever.com/upload/file/1811/EPEVER-Datasheet-XTRA.pdf
  - Manual: https://www.epever.com/upload/file/1811/XTRA-SMS-EL-V1.3.pdf
- SRNE ML2440:
  - Datasheet: https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_ML%20series_24V_20~40A_Solar%20Charge%20Controller_datasheet_V1.2.pdf
  - Manual: https://www.srnesolar.com/userfiles/files/2023/07/18/SR-ML24203040%20&%20ML2420-RS485_User%20Manual_V1.06.pdf
- SRNE MC4860N15:
  - Datasheet: https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_MC%20series_48V_60~70A_Solar%20Charge%20Controller_datasheet_1.1.pdf
  - Manual: https://www.srnesolar.com/userfiles/files/2023/07/18/User%20Manual_MPPT_MC4870N15%20V1.03.pdf
- EPEVER LS2024B: https://www.epever.com/wp-content/uploads/2021/05/EPEVER-Datasheet_LS-B.pdf

Popularity evidence (moderate; weakest for PWM):
- gosolarph.com calls EPEVER the PH default, with SRNE next.
- Victron has a PH distributor (PhilSolar).
- PowMr was dropped because its site blocked every fetch (403), so no PowMr value could be confirmed.

## 3. LiFePO4 batteries

| Model | nomV | Ah | kWh | maxC A | maxD A | Peak | Charge / cut-off V | DoD | Cycles | Parallel / series |
|---|---|---|---|---|---|---|---|---|---|---|
| PowMr POW-100AH-12.8V | 12.8 | 100 | 1.28 | 100 | 100 | BMS 110 A/30 s, 200 A/2–3 s | 14.0 (max 14.6) / 11.2 (min 10.8) | not stated | 6000 @ 80 % | 4P / 4S |
| PowMr POW-100AH-25.6V | 25.6 | 100 | 2.56 | 100 | 100 | BMS 110 A/5 s, 180 A/3 s | 29.2 / 22.4 (min 20) | not stated | 6000 @ 80 % | 2P / 2S |
| Pylontech US5000 | 48 | ~100 (derived: 4800 Wh ÷ 48 V) | 4.8 (4.56 usable) | 80 rec / 100 max | 80 rec / 100 max | 101–120 A for 15 min, 121–200 A for 15 s | 52.5–53.5 / 43.5 | 95 % | >6000 (spec) / >8000 (manual) | 16 (manual) or 20 (spec) / series not found |
| Dyness DL5.0C | 51.2 | 100 | 5.12 | 50 rec / 75 max | 50 rec / 100 max | 110 A for 15 s | range 44.8–57.6 | 90 % | ≥6000 @ 90 % | 50 / series not found |
| Deye SE-G5.1 Pro-B | 51.2 | 100 | 5.12 | 50 rec / 100 max | 50 rec / 100 max | 150 A for 2 min | range 43.2–57.6 | 90 % | ≥6000 @ 90 % | 64 / series not found |

Notes:
- The Pylontech documents contradict each other on cycles and parallel count, and the spec sheet misprints the nominal voltage as "8". The table uses the manual's values.
- The PowMr sheets are image-only PDFs, so their values were read visually.

Sources:
- PowMr 12.8V: https://cdn.shopify.com/s/files/1/0746/0415/1079/files/PowMr_POW-100AH-12.8V_LiFePO4_Battery_Specification_Sheet_dd924441-3823-4b0d-85bb-7e1921140ad3.pdf?v=1783672150
- PowMr 25.6V: https://cdn.shopify.com/s/files/1/0746/0415/1079/files/PowMr_POW-100AH-25.6V_LiFePO4_Battery_Specification_Sheet_082a3087-6f8c-4fc5-9e93-c5f446028bab.pdf?v=1783672181
- Pylontech US5000:
  - Spec sheet: https://global-site.oss-eu-central-1.aliyuncs.com/upload/2026/06/23/US%205000%20Spec_1782186290116.pdf
  - Manual: https://global-site.oss-eu-central-1.aliyuncs.com/upload/2024/09/25/RESS-Installation%20Manual-US5000%20US5000-B%205PMPA08-00219_V1.0_20240925124144A058.pdf
- Dyness DL5.0C: https://apac.dyness.com/Public/Uploads/uploadfile/files/20250909/DL5.0CDatasheetEN20250701.pdf
- Deye SE-G5.1 Pro-B: https://deye.com/wp-content/uploads/2026/09/deye-se-g5.1-pro-b-series_brochure_20260907v1.0.pdf

Popularity evidence:
- **12/24 V:** strong. Lazada PH sorted by popularity on 2026-11-08 shows PowMr listings at 16.4K, 3.8K and 2.8K sold.
- **48 V:** moderate. These sell through installers. Dyness's own news covers its Manila launch and local service. PH guides name Pylontech, Dyness and Deye.

## 4. Inverters

| Model | Category | nomV (range) | Rated / surge | eff | AC out | Idle W | Charge A | PV input (Voc · MPPT range · max I · max W · count) |
|---|---|---|---|---|---|---|---|---|
| Victron MultiPlus-II 24/3000/70-32 | Off-grid inverter/charger | 24 (19–33) | 2400 W (3000 VA) / 5500 W peak | 94 | 230 V, 50 Hz, adjustable to 60 Hz | 13 | 70 (AC) | none |
| Victron MultiPlus-II 48/5000/70-50 | Off-grid inverter/charger | 48 (38–66) | 4000 W (5000 VA) / 9000 W peak | 96 | same as above | 18 | 70 (AC) | none |
| Must EP3000 PLUS EP30-5048 | Off-grid, low-frequency | 48 | 5000 W / 15000 VA | >85 | 220–240 V; 60 Hz not found | not found | not confirmed | none |
| Deye SUN-3K-SG04LP1-24-EU | Grid-tie hybrid | 24 (20–30) | 3000 W / 2× for 10 s | 97.6 (likely PV-to-AC) | 230 V 50/60 Hz | not found | 140 batt | 500 · 150–425 · 13 · 3900 · 1 |
| Deye SUN-5K-SG04LP1-EU | Grid-tie hybrid | 48 (40–60) | 5000 W / 2× for 10 s | 97.6 (likely PV-to-AC) | 230 V 50/60 Hz | not found | 120 batt | 500 · 150–425 · 13+13 · 6500 · 2 |
| SRNE HF2430S80-H | Off-grid all-in-one + MPPT | 24 (20–33) | 3300 W / 6000 VA | 92 batt-to-AC | 230 V 50/60 Hz | not found | 80 AC / 80 MPPT | 500 · 120–450 · 13 · 4000 · 1 |
| SRNE HF4850S80-H | Off-grid all-in-one + MPPT | 48 (40–60) | 5000 W / 10000 VA | 92 batt-to-AC | 230 V 50/60 Hz | not found | 60 AC / 80 MPPT | 500 · 120–450 · 18 · 5200 · 1 |
| Growatt SPF 5000 ES | Off-grid all-in-one + MPPT | 48 | 5000 W / 10000 VA | 93 | 230 V 50/60 Hz | not found | 80 AC / 100 solar | 450 (2019 sheet) · 120–430 · not found · 5500 · not found |

Notes:
- The Must EP3000 PLUS row is incomplete because its datasheet PDF would not load. Don't use it until it is verified.
- Deye's 97.6 % is probably PV-to-AC efficiency. Only SRNE states a battery-to-AC figure (92 %).
- The Deye EU sheet lists no Philippine grid approval.

Sources:
- Victron: https://www.victronenergy.com/upload/documents/Datasheet-MultiPlus-II-inverter-charger-EN.pdf
- Must: https://www.mustpower.com/product/ep3000-plus-series-16kw/ (product page only)
- Deye: https://techstore-lb.com/wp-content/uploads/2024/01/deye-6kw-04.pdf (Deye's own sheet, hosted by a distributor because deye.com returns 403)
- SRNE: https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_HF series_HV_EU_solar charge inverter_datasheet_2(1).pdf
- Growatt: https://techstore-lb.com/wp-content/uploads/2024/01/growatt-5kw.pdf (Growatt's sheet from 2019, hosted by a distributor; check against a newer revision)

Popularity evidence:
- **Deye:** strong. It is the installers' default per gosolarph and solarstreamph, and J2 Solar PH lists it.
- **SRNE:** has an authorized PH distributor (Greewatt).
- **Growatt SPF:** watt-attack PH prices.
- **Victron:** has a PH distributor (PhilSolar).
- **Must:** weak.

---

## Fit with the current engine

| Type | Fits `CATALOG` as-is | Needs work |
|---|---|---|
| PV (all 6) | `ratedPower`, `voc`, `vmp`, `isc` | Add `imp` and `tcVoc` for a cold-morning Voc check (the PH minimum is mild, but highland sites exist) |
| MPPT (5) | `maxPvV`, `maxPvI`, `maxI`, `eff` | `nomV` is one value but the real units auto-select 12/24/48. Add an MPPT voltage window. SRNE ML2440 has no `maxPvI` |
| PWM LS2024B | `maxPvV`, `maxI` | `maxPvI` and `eff` not found |
| Battery (5) | `nomV`, `ah`, `maxC`, `maxD` | Pick one `maxC`/`maxD` convention (recommended vs max). Pylontech `ah` is derived |
| Off-grid inverter (Victron) | `nomV`, `ratedP`, `eff`, `acV` | Add surge and idle draw. Set 60 Hz |
| Hybrid / all-in-one (Deye, SRNE HF) | `hyb` (P2): `ratedP`, `nomV`, `maxPvV`, `maxPvI`, `maxI`, `eff`, `acV` | One PV input per unit; battery reserve and export limit are settings. Growatt needs `maxPvI` |

---

## Product photos

Collected 2026-11-08. Files are in `frontend/public/devices/<profile-id>.jpg` and registered in `frontend/src/engine/device-images.ts`, each with its source page.

- All 22 devices have a photo. 21 are from the manufacturer (website or official datasheet PDF). JA Solar is from a reseller (sun.store) because jasolar.com blocks downloads.
- Most PV, controller and hybrid photos show the product **series**, not the exact model. The SRNE HF pair and the Deye SG04LP1 pair share one image each. The Trina Vertex S+ photo is from the 2026 datasheet (450–475 W range).
- Some images were cropped: the Deye battery stack (top unit only), Dyness DL5.0C (cut from a room scene) and the SRNE MC.
- **Copyright:** these are manufacturers' marketing images. They're fine for internal or training use, but get permission (or use your own photos) before publishing SolarSketch publicly.

