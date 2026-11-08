import { create } from 'zustand'

import { deleteProfile, getProfile, isStorageAvailable, saveProfile } from '@/storage/repository'
import type { Profile } from '@/storage/schema'
import { t } from '@/i18n'

import { reportWriteError } from './storage-toast'

interface ProfileState {
  /** null until the user finishes or skips onboarding. */
  profile: Profile | null
  /** Saves the profile (also ends onboarding). Without storage it lasts for this session only. */
  save: (profile: Profile) => void
  /** Partial edit from Settings; ignored before onboarding. */
  update: (patch: Partial<Omit<Profile, 'onboardedAt' | 'noticeAcceptedAt' | 'legalVersion'>>) => void
  /** Forget the profile; onboarding shows again. */
  clear: () => Promise<void>
  reload: () => Promise<void>
}

const write = (p: Promise<unknown>) =>
  void p.catch((e) => {
    if (isStorageAvailable()) reportWriteError(e, t('Your profile could not be saved in this browser.'), 'profile-save-failed')
  })

/** Reactive mirror of the onboarding profile in browser storage. */
export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: null,
  save: (profile) => {
    if (isStorageAvailable()) write(saveProfile(profile))
    set({ profile })
  },
  update: (patch) => {
    const prev = get().profile
    if (!prev) return
    get().save({ ...prev, ...patch })
  },
  clear: async () => {
    if (isStorageAvailable()) await deleteProfile().catch(() => undefined)
    set({ profile: null })
  },
  reload: async () => set({ profile: await getProfile() }),
}))
