import { cn } from '@/lib/utils'

/** The eight rays, top first, clockwise. Each is the same short line turned about the centre. */
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/**
 * The SolarSketch sun mark. `animated` (the loader) turns the rays, pops each one outward in a
 * wave around the sun, and pulses the core. Keep in step with the splash in index.html.
 */
export function SunMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg aria-hidden="true" className={cn('flex-none overflow-visible text-primary', className)} viewBox="0 0 24 24">
      <circle className={animated ? 'sun-core' : undefined} cx="12" cy="12" r="5" fill="currentColor" />
      <g className={animated ? 'sun-rays' : undefined} stroke="currentColor" strokeLinecap="round" strokeWidth="2.25">
        {RAYS.map((deg, i) => (
          <g key={deg} transform={`rotate(${deg} 12 12)`}>
            <line className={animated ? 'sun-ray' : undefined} style={animated ? { animationDelay: `${i * 0.15}s` } : undefined} x1="12" y1="1.5" x2="12" y2="4" />
          </g>
        ))}
      </g>
    </svg>
  )
}
