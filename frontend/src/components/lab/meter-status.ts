import { t } from '@/i18n'

/** Live status of a Smart CT meter at the grid connection: + = import, − = export. */
export const ctmStatus = (w: number) => (w > 1 ? t('Importing {w} W', { w: w.toFixed(0) }) : w < -1 ? t('Exporting {w} W', { w: (-w).toFixed(0) }) : t('0 W at the grid'))
