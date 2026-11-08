/**
 * Privacy Policy and Terms of Service. They describe what the app actually does (no accounts, no
 * server, no analytics; data stays in this browser), so update them whenever that changes, and bump
 * LEGAL_VERSION. The text stays English until a qualified reviewer checks a translation.
 *
 * DRAFT: have a lawyer review both documents before a public release.
 */

export const LEGAL_VERSION = '1.0'
export const LEGAL_EFFECTIVE = '2026-11-09'

/**
 * Who publishes the app and how to reach them. Fill these in before a public release; the
 * documents show a contact line only when `contact` is set.
 */
export const LEGAL_OPERATOR: { name: string; contact?: string } = { name: 'SolarSketch' }

export interface LegalSection {
  heading: string
  /** Paragraphs; an array inside is rendered as a bullet list. */
  body: (string | string[])[]
}

export interface LegalDoc {
  id: 'privacy' | 'terms'
  title: string
  summary: string
  sections: LegalSection[]
}

const contactLine = () =>
  LEGAL_OPERATOR.contact
    ? `Questions about this document can be sent to ${LEGAL_OPERATOR.contact}.`
    : `Questions about this document can be sent to ${LEGAL_OPERATOR.name} through the contact details published where you obtained the app.`

export const PRIVACY_POLICY: LegalDoc = {
  id: 'privacy',
  title: 'Privacy Policy',
  summary: 'SolarSketch has no accounts and no server. Everything you enter stays in this browser on this device, and we do not collect, receive or sell your data.',
  sections: [
    {
      heading: '1. Who we are',
      body: [`This policy covers the SolarSketch web app ("SolarSketch", "we"), published by ${LEGAL_OPERATOR.name}. SolarSketch is an educational virtual lab for learning solar PV installation.`],
    },
    {
      heading: '2. What is stored, and where',
      body: [
        'SolarSketch saves the following only in your browser’s storage (IndexedDB, or localStorage where IndexedDB is unavailable) on the device you are using:',
        [
          'Your setup answers: the name or nickname you enter (optional), your expertise level, purpose and goals, and the dates you finished setup and accepted these documents.',
          'Your projects: components, wiring, specifications, project names and any faults or tasks attached to them.',
          'Your learning progress: lesson completion, knowledge-check scores and challenge attempts.',
          'Your settings: theme, language, canvas options and panel layout.',
          'Equipment catalog files you import.',
        ],
        'The browser also keeps a copy of the app’s own files so it can work offline. That copy contains no personal data.',
      ],
    },
    {
      heading: '3. What we receive',
      body: [
        'Nothing. SolarSketch has no account system, no backend server, no analytics, no advertising and no tracking cookies, and it does not send your projects, answers or progress anywhere. Validation, simulation and scoring all run in your browser.',
        'The app’s fonts and scripts are served from the same site as the app, so loading SolarSketch does not contact third-party services. The company hosting the app may keep standard server logs (such as IP address, browser type and time of request) when your browser downloads the app files. Those logs are governed by the hosting provider’s own policy.',
      ],
    },
    {
      heading: '4. Links to other sites',
      body: ['Some equipment profiles link to manufacturers’ datasheets. Opening one takes you to that manufacturer’s website, whose own privacy policy applies.'],
    },
    {
      heading: '5. Files you export or import',
      body: [
        'When you export a project, report or diagram, the file is saved where you choose and is under your control. If you share it, the people you share it with can read everything in it.',
        'Files you import are read and checked inside your browser; they are not uploaded.',
      ],
    },
    {
      heading: '6. Your choices and how to delete your data',
      body: [
        [
          'Change or clear your setup answers anytime in Settings.',
          'Delete projects in My Projects, or delete everything with Settings → Delete all data.',
          'Clearing this site’s data in your browser settings, or using a private window, also removes it.',
        ],
        'Because we never receive your data, we cannot view, recover or delete it for you. Export projects you want to keep.',
      ],
    },
    {
      heading: '7. Your rights',
      body: [
        'Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) you have rights over your personal data, including to be informed, to access, to correct and to erase it. Since your data stays on your device, you can exercise these rights directly using the controls above.',
      ],
    },
    {
      heading: '8. Children and students',
      body: ['SolarSketch does not ask for contact details or identity information. Younger learners should use it with the guidance of a parent, guardian or teacher, and may leave the name field empty.'],
    },
    {
      heading: '9. Security',
      body: ['Data in browser storage is protected by your device and browser, not by us. Anyone who can use your browser profile can open your projects, so use a device account or browser profile of your own on shared computers.'],
    },
    {
      heading: '10. Changes to this policy',
      body: ['If this policy changes, the version and effective date above will change, and SolarSketch will ask you to review the new version.'],
    },
    { heading: '11. Contact', body: [contactLine()] },
  ],
}

export const TERMS_OF_SERVICE: LegalDoc = {
  id: 'terms',
  title: 'Terms of Service',
  summary: 'SolarSketch is a free learning tool. Its results are simplified simulations, not engineering advice, and they never certify a real installation.',
  sections: [
    {
      heading: '1. Accepting these terms',
      body: ['By using SolarSketch you agree to these terms and to the Privacy Policy. If you do not agree, do not use the app.'],
    },
    {
      heading: '2. Educational use only',
      body: [
        'SolarSketch is an educational simulation for learning solar PV concepts and practising installation steps.',
        [
          'A passing result does not certify an installation as safe, PEC-compliant or professionally approved, and it is not a substitute for the Philippine Electrical Code, a manufacturer’s installation instructions or the judgment of a licensed professional.',
          'Real electrical installations must be designed, installed and inspected by qualified, licensed persons, and must follow applicable laws, codes and permits.',
          'Do not rely on SolarSketch to make safety decisions about live equipment.',
        ],
      ],
    },
    {
      heading: '3. Limits of the simulation',
      body: [
        'The electrical models are deliberately simplified. For example, PV output uses P = P_STC × (G ÷ 1000) × f, and loads follow fixed schedules. Results can differ substantially from real equipment, weather and site conditions, and the rules may not cover every hazard.',
      ],
    },
    {
      heading: '4. Equipment data and trademarks',
      body: [
        [
          '"Generic" equipment profiles use illustrative example values, not data for any real product.',
          'Profiles for named products use values taken from the manufacturers’ published datasheets. They may contain transcription errors, may be marked as not yet reviewed, and may be out of date when a manufacturer revises a product. Always check the current datasheet.',
          'Brand and product names are the trademarks of their owners and are used only to identify the products. SolarSketch is not affiliated with, sponsored by or endorsed by any manufacturer.',
          'Product photos belong to their manufacturers. Other images are credited to their authors under their licences.',
        ],
      ],
    },
    {
      heading: '5. Your projects and data',
      body: [
        'Your projects belong to you. They are stored only in your browser, so you are responsible for keeping copies: export anything you want to keep. We cannot recover data lost when browser storage is cleared, full, or unavailable.',
      ],
    },
    {
      heading: '6. Acceptable use',
      body: [
        'Do not present SolarSketch results as a certification, inspection or professional approval of a real installation, and do not attempt to disrupt the site that hosts the app.',
      ],
    },
    {
      heading: '7. No warranty',
      body: ['SolarSketch is provided "as is" and "as available", without warranties of any kind, including accuracy, fitness for a particular purpose or uninterrupted availability.'],
    },
    {
      heading: '8. Limitation of liability',
      body: [
        `To the fullest extent permitted by law, ${LEGAL_OPERATOR.name} is not liable for any loss, damage, injury or cost arising from the use of SolarSketch or from reliance on its results, including loss of data stored in your browser.`,
      ],
    },
    {
      heading: '9. Changes',
      body: ['We may update the app and these terms. When the terms change, the version and effective date above will change, and SolarSketch will ask you to review them.'],
    },
    {
      heading: '10. Governing law',
      body: ['These terms are governed by the laws of the Republic of the Philippines.'],
    },
    { heading: '11. Contact', body: [contactLine()] },
  ],
}

export const LEGAL_DOCS = { privacy: PRIVACY_POLICY, terms: TERMS_OF_SERVICE }
