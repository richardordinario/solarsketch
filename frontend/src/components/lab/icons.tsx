import type { ReactNode } from 'react'

/** Line icons copied verbatim from the Virtual Lab v2 design spec (24px grid, 1.5 stroke). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="block flex-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
      {children}
    </svg>
  )
}

export const SaveIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C12.3415 2 12.5122 2 12.6858 2.01515C13.4951 2.08581 14.2874 2.414 14.9097 2.93631C15.0431 3.04835 15.1668 3.17206 15.4142 3.41944L20.5806 8.58578C20.828 8.83317 20.9516 8.95687 21.0637 9.09034C21.586 9.71257 21.9142 10.5049 21.9848 11.3142C22 11.4878 22 11.6585 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z" />
      <path d="M17 21.8731V21C17 19.1144 17 18.1716 16.4142 17.5858C15.8284 17 14.8856 17 13 17H11C9.11438 17 8.17157 17 7.58579 17.5858C7 18.1716 7 19.1144 7 21V21.8731" />
      <path d="M7 8H13" />
    </g>
  </Icon>
)

export const SelectIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12.6361 15.2616L16.5744 19.1999C16.9821 19.6077 17.186 19.8116 17.4135 19.9058C17.7168 20.0314 18.0575 20.0314 18.3608 19.9058C18.5882 19.8116 18.7921 19.6077 19.1999 19.1999C19.6077 18.7921 19.8116 18.5882 19.9058 18.3608C20.0314 18.0575 20.0314 17.7168 19.9058 17.4135C19.8116 17.186 19.6077 16.9821 19.1999 16.5744L15.2616 12.6361L16.4643 11.4334C17.6955 10.2022 18.3111 9.58656 18.1658 8.92489C18.0204 8.26322 17.2035 7.96225 15.5696 7.3603L10.1205 5.35271C6.86106 4.15187 5.23136 3.55146 4.39141 4.39141C3.55146 5.23136 4.15187 6.86106 5.3527 10.1205L7.3603 15.5696C7.96225 17.2035 8.26322 18.0204 8.92489 18.1658C9.58656 18.3111 10.2022 17.6955 11.4334 16.4643L12.6361 15.2616Z" />
  </Icon>
)

export const WireIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M2 5.25732C2 3.45835 3.567 2 5.5 2C7.433 2 9 3.45835 9 5.25732C9 7.04219 7.88292 9.12497 6.14003 9.86978C5.73374 10.0434 5.26626 10.0434 4.85997 9.86978C3.11708 9.12497 2 7.04219 2 5.25732Z" />
      <path d="M15 17.2573C15 15.4584 16.567 14 18.5 14C20.433 14 22 15.4584 22 17.2573C22 19.0422 20.8829 21.125 19.14 21.8698C18.7337 22.0434 18.2663 22.0434 17.86 21.8698C16.1171 21.125 15 19.0422 15 17.2573Z" />
      <path strokeLinejoin="round" d="M18.5 17.5H18.509" />
      <path strokeLinejoin="round" d="M5.49023 5.5H5.49923" />
      <path strokeLinejoin="round" d="M11.9997 5H16.1316C18.1325 5 18.8934 7.61309 17.2054 8.68732L6.7941 15.3127C5.10602 16.3869 5.86695 19 7.86784 19H11.9997M10.4997 20.5L11.9997 19L10.4997 17.5" />
    </g>
  </Icon>
)

export const PanIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M18.9999 15L21.9999 12L18.9999 9M21.9999 12L14.9999 12M4.99994 9L1.99994 12L4.99994 15M1.99994 12L8.99994 12" />
      <path d="M9.00025 5L12.0002 2L15.0002 5M12.0002 2L12.0002 9M15.0002 19L12.0002 22L9.00025 19M12.0002 22L12.0002 15" />
    </g>
  </Icon>
)

export const UndoIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7H15C16.8692 7 17.8039 7 18.5 7.40193C18.9561 7.66523 19.3348 8.04394 19.5981 8.49999C20 9.19615 20 10.1308 20 12C20 13.8692 20 14.8038 19.5981 15.5C19.3348 15.9561 18.9561 16.3348 18.5 16.5981C17.8039 17 16.8692 17 15 17H8.00001M7 10L4 7L7 4" />
  </Icon>
)

export const RedoIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7H9.00001C7.13077 7 6.19615 7 5.5 7.40193C5.04395 7.66523 4.66524 8.04394 4.40193 8.49999C4 9.19615 4 10.1308 4 12C4 13.8692 4 14.8038 4.40192 15.5C4.66523 15.9561 5.04394 16.3348 5.5 16.5981C6.19615 17 7.13077 17 9 17H16M17 10L20 7L17 4" />
  </Icon>
)

export const DuplicateIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M12 22H15C17.8284 22 19.2426 22 20.1213 21.1213C21 20.2426 21 18.8284 21 16V11C21 8.17157 21 6.75736 20.1213 5.87868C19.2426 5 17.8284 5 15 5H12C9.17157 5 7.75736 5 6.87868 5.87868C6 6.75736 6 8.17157 6 11V16C6 18.8284 6 20.2426 6.87868 21.1213C7.75736 22 9.17157 22 12 22Z" />
      <path d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5" />
    </g>
  </Icon>
)

export const RotateIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 8.05026L17.6569 7.34315C14.5327 4.21896 9.46734 4.21896 6.34315 7.34315C3.21895 10.4673 3.21895 15.5327 6.34315 18.6569C9.46734 21.7811 14.5327 21.7811 17.6569 18.6569C19.4737 16.84 20.234 14.3668 19.9377 12.0005M18.364 3.80762V8.05026H14.1213" />
  </Icon>
)

export const DeleteIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M9.1709 4C9.58273 2.83481 10.694 2 12.0002 2C13.3064 2 14.4177 2.83481 14.8295 4" />
      <path d="M20.5001 6H3.5" />
      <path d="M18.8332 8.5L18.3732 15.3991C18.1962 18.054 18.1077 19.3815 17.2427 20.1907C16.3777 21 15.0473 21 12.3865 21H11.6132C8.95235 21 7.62195 21 6.75694 20.1907C5.89194 19.3815 5.80344 18.054 5.62644 15.3991L5.1665 8.5" />
      <path d="M9.5 11L10 16" />
      <path d="M14.5 11L14 16" />
    </g>
  </Icon>
)

export const ZoomOutIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <circle cx="11.5" cy="11.5" r="9.5" />
      <path d="M9 11.5H11.5H14" />
      <path d="M18.2168 18.2178L21.9994 22.0004" />
    </g>
  </Icon>
)

export const ZoomInIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <circle cx="11.5" cy="11.5" r="9.5" />
      <path d="M9 11.5H11.5M11.5 11.5H14M11.5 11.5V14M11.5 11.5V9" />
      <path d="M18.2168 18.2178L21.9994 22.0004" />
    </g>
  </Icon>
)

export const FitIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path strokeLinejoin="round" d="M12 12L17 7M17 10.75V7H13.25" />
      <path strokeLinejoin="round" d="M12 12L7 17M7 13.25V17H10.75" />
      <path d="M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z" />
    </g>
  </Icon>
)

export const PauseIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M6 22C4.11438 22 3.17157 22 2.58579 21.4142C2 20.8284 2 19.8856 2 18V6C2 4.11438 2 3.17157 2.58579 2.58579C3.17157 2 4.11438 2 6 2C7.88562 2 8.82843 2 9.41421 2.58579C10 3.17157 10 4.11438 10 6V18C10 19.8856 10 20.8284 9.41421 21.4142C8.82843 22 7.88562 22 6 22Z" />
      <path d="M18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V6C14 4.11438 14 3.17157 14.5858 2.58579C15.1716 2 16.1144 2 18 2C19.8856 2 20.8284 2 21.4142 2.58579C22 3.17157 22 4.11438 22 6V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22Z" />
    </g>
  </Icon>
)

export const PlayIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" d="M3 5.0329L3 18.9671C3 21.2763 5.53435 22.736 7.59662 21.6145L20.4086 14.6474C22.5305 13.4935 22.5305 10.5065 20.4086 9.35258L7.59661 2.38548C5.53435 1.26402 3 2.72368 3 5.0329Z" />
  </Icon>
)

export const StopIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" d="M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z" />
  </Icon>
)

export const ChevronDownIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9L12 15L5 9" />
  </Icon>
)

export const ChevronLeftIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 5L9 12L15 19" />
  </Icon>
)

export const ChevronRightIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5L15 12L9 19" />
  </Icon>
)

export const ChevronUpIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 15L12 9L5 15" />
  </Icon>
)

export const SunIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2V3.5M12 20.5V22M4.93 4.93L5.99 5.99M18.01 18.01L19.07 19.07M2 12H3.5M20.5 12H22M4.93 19.07L5.99 18.01M18.01 5.99L19.07 4.93" />
    </g>
  </Icon>
)

export const MoonIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
  </Icon>
)

export const SettingsIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  </Icon>
)

export const SunriseIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0" />
    </g>
  </Icon>
)

export const NoonIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <circle cx="12" cy="11" r="4" />
      <path d="M12 3v1.5M6.34 5.34l1.06 1.06M17.66 5.34L16.6 6.4M4 11h1.5M18.5 11H20M2 20h20" />
    </g>
  </Icon>
)

export const SunsetIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M12 10V2M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0" />
    </g>
  </Icon>
)

export const PartlyCloudyIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
    </g>
  </Icon>
)

export const CloudIcon = () => (
  <Icon>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </g>
  </Icon>
)

/** Counter-clockwise arrow: reset the simulation to the start of the day. */
export const ResetIcon = () => (
  <Icon>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.636 8.05026L6.34315 7.34315C9.46734 4.21896 14.5327 4.21896 17.6569 7.34315C20.781 10.4673 20.781 15.5327 17.6569 18.6569C14.5327 21.7811 9.46734 21.7811 6.34315 18.6569C4.52632 16.84 3.76598 14.3668 4.06227 12.0005M5.636 3.80762V8.05026H9.87868" />
  </Icon>
)
