import { create } from 'zustand'

import { MY_DEVICES_ID, MY_DEVICES_NAME, parseCatalog, parseDevice, type UserCatalog } from '@/engine/catalog-import'
import { setUserProfiles, type EquipmentProfile } from '@/engine/profiles'
import { getUserCatalogs, saveUserCatalogs } from '@/storage/repository'

interface CatalogState {
  catalogs: UserCatalog[]
  reload: () => Promise<void>
  /** Parse, store and activate a catalog file. Throws CatalogImportError or StorageFullError. */
  importText: (text: string) => Promise<UserCatalog>
  remove: (id: string) => Promise<void>
  /** Validate and store one device from the Add component form (in the "My devices" catalog). Throws CatalogImportError or StorageFullError. */
  addDevice: (input: unknown) => Promise<EquipmentProfile>
  /** Remove one device; a catalog left empty is removed too. */
  removeDevice: (catalogId: string, profileId: string) => Promise<void>
}

const activate = (list: UserCatalog[]) => setUserProfiles(list.flatMap((c) => c.profiles))

/** Imported equipment catalogs; keeps engine/profiles.ts in sync. */
export const useCatalogStore = create<CatalogState>()((set, get) => ({
  catalogs: [],
  reload: async () => {
    const catalogs = await getUserCatalogs()
    activate(catalogs)
    set({ catalogs })
  },
  importText: async (text) => {
    const cat = parseCatalog(text)
    const next = get().catalogs.concat([cat])
    await saveUserCatalogs(next)
    activate(next)
    set({ catalogs: next })
    return cat
  },
  remove: async (id) => {
    const next = get().catalogs.filter((c) => c.id !== id)
    await saveUserCatalogs(next)
    activate(next)
    set({ catalogs: next })
  },
  addDevice: async (input) => {
    const profile = parseDevice(input)
    const list = get().catalogs
    const mine = list.find((c) => c.id === MY_DEVICES_ID)
    const next = mine
      ? list.map((c) => (c === mine ? { ...c, profiles: c.profiles.concat([profile]) } : c))
      : list.concat([{ id: MY_DEVICES_ID, name: MY_DEVICES_NAME, importedAt: new Date().toISOString(), profiles: [profile] }])
    await saveUserCatalogs(next)
    activate(next)
    set({ catalogs: next })
    return profile
  },
  removeDevice: async (catalogId, profileId) => {
    const next = get()
      .catalogs.map((c) => (c.id === catalogId ? { ...c, profiles: c.profiles.filter((p) => p.id !== profileId) } : c))
      .filter((c) => c.profiles.length)
    await saveUserCatalogs(next)
    activate(next)
    set({ catalogs: next })
  },
}))
