/**
 * Onboarding choices and the starting point they suggest. Labels are English source strings;
 * wrap them in t() where they are shown.
 */
import type { Expertise, Goal, Profile, Purpose } from '@/storage/schema'

export const EXPERTISE_OPTIONS: { value: Expertise; label: string; hint: string }[] = [
  { value: 'new', label: 'New to electricity', hint: 'I have not worked with circuits, volts or amps yet.' },
  { value: 'beginner', label: 'Beginner', hint: 'I know basic volts, amps and watts, but solar is new to me.' },
  { value: 'intermediate', label: 'Intermediate', hint: 'I have an electrical background or have helped install a small system.' },
  { value: 'professional', label: 'Professional', hint: 'I design, install or maintain solar or electrical systems for work.' },
]

export const PURPOSE_OPTIONS: { value: Purpose; label: string; hint: string }[] = [
  { value: 'work', label: 'For work', hint: 'Installer, technician, electrician or engineer.' },
  { value: 'study', label: 'For school or training', hint: 'TESDA, college, review or a training course.' },
  { value: 'home', label: 'For my own home', hint: 'Understanding or planning a system for my house.' },
  { value: 'hobby', label: 'Hobby or DIY', hint: 'Small projects, a kubo, a van or a boat, or just curious.' },
]

export const GOAL_OPTIONS: { value: Goal; label: string; hint: string }[] = [
  { value: 'off-grid', label: 'Off-grid system', hint: 'Solar, battery and inverter with no utility connection.' },
  { value: 'grid-tied', label: 'Grid-tied with net metering', hint: 'Solar that exports surplus to the utility.' },
  { value: 'hybrid', label: 'Hybrid with battery backup', hint: 'Solar, battery and grid, with backup in a brownout.' },
  { value: 'small-dc', label: 'Small 12 V DC setup', hint: 'Lights, fans and phone charging from one panel and battery.' },
  { value: 'troubleshooting', label: 'Troubleshooting and maintenance', hint: 'Finding faults with measurements in existing systems.' },
  { value: 'basics', label: 'Just the basics', hint: 'Understand how solar works before choosing anything.' },
]

/** The template (engine/sample-project TEMPLATES id) that matches a goal, if any. */
const GOAL_TEMPLATE: Partial<Record<Goal, string>> = { 'off-grid': 'off-grid', 'grid-tied': 'grid-tied', hybrid: 'hybrid-solar', 'small-dc': 'off-grid' }

export interface Recommendation {
  /** First lesson to open, or null to start with the challenges. */
  lessonId: string | null
  /** A system template to try in the Virtual Lab. */
  templateId: string | null
}

/** Where to start, from the onboarding answers. */
export function recommend(p: Pick<Profile, 'expertise' | 'goals'>): Recommendation {
  const advanced = p.expertise === 'intermediate' || p.expertise === 'professional'
  const lessonId =
    advanced && (p.goals.includes('troubleshooting') || p.expertise === 'professional')
      ? null
      : p.expertise === 'new'
        ? 'electricity-basics'
        : p.expertise === 'intermediate'
          ? 'system-types'
          : 'solar-basics'
  const templateId = p.goals.map((g) => GOAL_TEMPLATE[g]).find((x) => x) ?? null
  return { lessonId, templateId }
}

/** Up to two initials from the name in Settings: "Juan dela Cruz" -> "JC", "Ana" -> "A", "" -> "". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const first = (w: string) => Array.from(w)[0].toLocaleUpperCase()
  return words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1])
}
