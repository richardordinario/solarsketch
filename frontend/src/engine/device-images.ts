/**
 * Product photos for built-in real devices (engine/profiles.ts), stored in public/devices/.
 * Each records where it came from. `match: 'series'` means the photo shows the product range
 * the model belongs to, not necessarily that exact model. Photos are illustrations only.
 */
export interface DeviceImage {
  /** Path under the site base, e.g. "devices/<profile-id>.jpg". */
  file: string
  sourcePage: string
  /** True when taken from the manufacturer's own website. */
  official: boolean
  match: 'exact' | 'series'
}

export const DEVICE_IMAGES: Record<string, DeviceImage> = {
  'pv-jinko-jkm580n-72hl4-bdv': { file: 'devices/pv-jinko-jkm580n-72hl4-bdv.jpg', sourcePage: 'https://www.jinkosolar.com/en/site/tigerneo', official: true, match: 'series' },
  'pv-longi-lr5-54hth-430m': { file: 'devices/pv-longi-lr5-54hth-430m.jpg', sourcePage: 'https://www.longi.com/en/products/modules/hi-mo-6-explorer/', official: true, match: 'series' },
  'pv-ja-jam72s30-550-mr': { file: 'devices/pv-ja-jam72s30-550-mr.jpg', sourcePage: 'https://sun.store/en/product/ja-solar-jam72s30-550-mr-540-565-1000v-silver-frame-mc4-evo2a-40306', official: false, match: 'series' },
  'pv-canadian-cs6w-550ms': { file: 'devices/pv-canadian-cs6w-550ms.jpg', sourcePage: 'https://static.csisolar.com/wp-content/uploads/2024/07/23145733/CS-Datasheet-HiKu6_CS6W-MS_v2.9_EN.pdf', official: true, match: 'series' },
  'pv-trina-tsm-440neg9r28': { file: 'devices/pv-trina-tsm-440neg9r28.jpg', sourcePage: 'https://www.trinasolar.com/en-glb/VertexSPlus/', official: true, match: 'series' },
  'pv-trina-tsm-600neg19rc20': { file: 'devices/pv-trina-tsm-600neg19rc20.jpg', sourcePage: 'https://www.trinasolar.com/en-glb/VertexN/', official: true, match: 'series' },
  'bat-powmr-pow-100ah-12v8': { file: 'devices/bat-powmr-pow-100ah-12v8.jpg', sourcePage: 'https://powmr.com/products/lithium-battery-100ah-12-8v', official: true, match: 'exact' },
  'bat-powmr-pow-100ah-25v6': { file: 'devices/bat-powmr-pow-100ah-25v6.jpg', sourcePage: 'https://powmr.com/products/100ah-25-6v-mini-lithium-energy-storage-battery', official: true, match: 'exact' },
  'bat-pylontech-us5000': { file: 'devices/bat-pylontech-us5000.jpg', sourcePage: 'https://en.pylontech.com.cn/products/us5000', official: true, match: 'exact' },
  'bat-dyness-dl5-0c': { file: 'devices/bat-dyness-dl5-0c.jpg', sourcePage: 'https://www.dyness.com/Public/Uploads/uploadfile/files/20250318/DynessDL5.0Cdatasheet20250228EN-177.pdf', official: true, match: 'exact' },
  'bat-deye-se-g5-1-pro-b': { file: 'devices/bat-deye-se-g5-1-pro-b.jpg', sourcePage: 'https://deye.com/product/se-g5-1-pro-b/', official: true, match: 'exact' },
  'mppt-victron-smartsolar-150-35': { file: 'devices/mppt-victron-smartsolar-150-35.jpg', sourcePage: 'https://www.victronenergy.com/solar-charge-controllers/smartsolar-150-35', official: true, match: 'exact' },
  'mppt-epever-tracer3210an-g3': { file: 'devices/mppt-epever-tracer3210an-g3.jpg', sourcePage: 'https://www.epever.com/product/tracer-an-g3-series-mppt-charge-controller/', official: true, match: 'series' },
  'mppt-epever-xtra4415n': { file: 'devices/mppt-epever-xtra4415n.jpg', sourcePage: 'https://www.epever.com/product/xtra-n-g3-mppt-charge-controller/', official: true, match: 'series' },
  'mppt-srne-ml2440': { file: 'devices/mppt-srne-ml2440.jpg', sourcePage: 'https://www.srnesolar.com/productdetail/Mppt-Solar-Charge-Controller-ML.html', official: true, match: 'series' },
  'mppt-srne-mc4860n15': { file: 'devices/mppt-srne-mc4860n15.jpg', sourcePage: 'https://srnesolar.com/productdetail/Mppt-Solar-Charge-Controller-MC48v.html', official: true, match: 'series' },
  'inv-victron-multiplus-ii-24-3000': { file: 'devices/inv-victron-multiplus-ii-24-3000.jpg', sourcePage: 'https://www.victronenergy.com/inverters-chargers/multiplus-ii', official: true, match: 'exact' },
  'inv-victron-multiplus-ii-48-5000': { file: 'devices/inv-victron-multiplus-ii-48-5000.jpg', sourcePage: 'https://www.victronenergy.com/inverters-chargers/multiplus-ii', official: true, match: 'exact' },
  'hyb-deye-sun-3k-sg04lp1-24': { file: 'devices/hyb-deye-sun-3k-sg04lp1-24.jpg', sourcePage: 'https://www.deyeinverter.com/product/single-phase-low-voltage-hybrid-inverter/sun3-3-6-5-6ksg04lp1-3-6kw-single-phase.html', official: true, match: 'series' },
  'hyb-deye-sun-5k-sg04lp1': { file: 'devices/hyb-deye-sun-5k-sg04lp1.jpg', sourcePage: 'https://www.deyeinverter.com/product/single-phase-low-voltage-hybrid-inverter/sun3-3-6-5-6ksg04lp1-3-6kw-single-phase.html', official: true, match: 'series' },
  'hyb-srne-hf2430s80-h': { file: 'devices/hyb-srne-hf2430s80-h.jpg', sourcePage: 'https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_HF%20series_HV_EU_solar%20charge%20inverter_datasheet_2(1).pdf', official: true, match: 'series' },
  'hyb-srne-hf4850s80-h': { file: 'devices/hyb-srne-hf4850s80-h.jpg', sourcePage: 'https://www.srnesolar.com/userfiles/files/2023/07/18/SRNE_HF%20series_HV_EU_solar%20charge%20inverter_datasheet_2(1).pdf', official: true, match: 'series' },
}

export const deviceImage = (profileId: string | undefined) => (profileId ? DEVICE_IMAGES[profileId] : undefined)
