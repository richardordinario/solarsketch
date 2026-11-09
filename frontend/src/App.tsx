import { useEffect, useRef } from 'react'

import { Onboarding } from '@/components/app/onboarding'
import { PwaPrompt } from '@/components/app/pwa-prompt'
import { SunLoader } from '@/components/app/sun-loader'
import { TopBar } from '@/components/lab/top-bar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoute, type Route } from '@/lib/router'
import { ChallengesPage } from '@/pages/challenges'
import { ComponentsPage } from '@/pages/components-page'
import { LandingPage } from '@/pages/landing'
import { LearnPage } from '@/pages/learn'
import { ProgressPage } from '@/pages/progress'
import { ProjectsPage } from '@/pages/projects'
import { LegalPage } from '@/pages/legal'
import { SettingsPage } from '@/pages/settings'
import { VirtualLabPage } from '@/pages/virtual-lab'
import { isStorageAvailable } from '@/storage/repository'
import { useLoaderStore, withLoader } from '@/store/loader-store'
import { startAutosave, watchOtherTabs } from '@/store/persistence'
import { t, useLangStore } from '@/i18n'

function StorageBanner() {
  if (isStorageAvailable()) return null
  return (
    <div role="status" className="edge-b bg-(--fix-bg) px-4 py-1.5 text-[12px] font-semibold [border-bottom:var(--fix-border)]">
      {t('Browser storage is unavailable (for example in a private window). Your work will not be saved. Export projects from My Projects to keep a copy.')}
    </div>
  )
}

const PAGE_NAME: Record<Route['page'], string> = {
  landing: 'SolarSketch',
  lab: 'Virtual Lab',
  learn: 'Learn',
  components: 'Component Library',
  projects: 'My Projects',
  challenges: 'Challenges',
  progress: 'Progress',
  settings: 'Settings',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
}
/** Page changes show the sun loader briefly; shorter than project opening so navigation stays quick. */
const PAGE_LOADER_MS = 450

/** Shows the sun loader on every page change after the first (the splash covers the first). */
function usePageLoader(route: Route) {
  const key = JSON.stringify(route)
  const prev = useRef(key)
  useEffect(() => {
    if (prev.current === key) return
    prev.current = key
    // Opening a project already shows the loader with the project's name.
    if (useLoaderStore.getState().label !== null) return
    void withLoader(t('Opening {name}…', { name: t(PAGE_NAME[route.page]) }), async () => undefined, PAGE_LOADER_MS)
  }, [key, route.page])
}

function CurrentPage() {
  const route = useRoute()
  switch (route.page) {
    case 'landing':
      return <LandingPage />
    case 'learn':
      return <LearnPage lessonId={route.lessonId} />
    case 'challenges':
      return <ChallengesPage challengeId={route.challengeId} />
    case 'components':
      return <ComponentsPage key={route.type ?? ''} type={route.type} />
    case 'projects':
      return <ProjectsPage />
    case 'progress':
      return <ProgressPage />
    case 'settings':
      return <SettingsPage />
    case 'privacy':
    case 'terms':
      return <LegalPage key={route.page} docId={route.page} />
    default:
      return <VirtualLabPage />
  }
}

export default function App() {
  const lang = useLangStore((s) => s.lang)
  const route = useRoute()
  usePageLoader(route)
  useEffect(() => {
    const stopAutosave = startAutosave()
    const stopWatching = watchOtherTabs()
    return () => {
      stopAutosave()
      stopWatching()
    }
  }, [])

  return (
    <TooltipProvider delay={400}>
      {/* Re-mount the UI when the language changes; projects and simulation live in stores. */}
      <div key={lang} className="flex h-screen flex-col overflow-hidden bg-background text-[13px] leading-[1.4]">
        {route.page !== 'lab' && route.page !== 'landing' && (
          <div className="h-12 flex-none">
            <TopBar />
          </div>
        )}
        <StorageBanner />
        <div className="min-h-0 min-w-0 flex-1">
          <CurrentPage />
        </div>
      </div>
      <Toaster position="bottom-right" />
      <PwaPrompt />
      {/* Outside the language-keyed shell, so switching language keeps the answers so far. Not over the landing page. */}
      {route.page !== 'landing' && <Onboarding />}
      <SunLoader />
    </TooltipProvider>
  )
}
