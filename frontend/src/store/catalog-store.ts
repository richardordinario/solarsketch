import { create } from 'zustand'

import { parseCatalog, type UserCatalog } from '@/engine/catalog-import'
import { setUserProfiles } from '@/engine/profiles'
import { getUserCatalogs, saveUserCatalogs } from '@/storage/repository'

interface CatalogState {
  catalogs: UserCatalog[]
  reload: () => Promise<void>
  /** Parse, store and activate a catalog file. Throws CatalogImportError or StorageFullError. */
  importText: (text: string) => Promise<UserCatalog>
  remove: (id: string) => Promise<void>
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
}))
