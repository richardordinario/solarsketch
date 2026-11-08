import { Notice, Page } from '@/components/app/page'
import { LEGAL_DOCS, LEGAL_EFFECTIVE, LEGAL_VERSION, type LegalDoc } from '@/content/legal'
import { href } from '@/lib/router'
import { useLangStore, useT } from '@/i18n'

/** The sections of a legal document; shared by its page and the setup wizard. */
export function LegalBody({ doc, compact }: { doc: LegalDoc; compact?: boolean }) {
  return (
    <div className={compact ? 'text-[12px]' : 'text-[14px]'}>
      {doc.sections.map((s) => (
        <section key={s.heading} className={compact ? 'mb-3' : 'mb-6'}>
          <h2 className={compact ? 'm-0 mb-1 text-[12px] font-strong' : 'm-0 mb-2 text-[16px] font-strong'}>{s.heading}</h2>
          {s.body.map((b, i) =>
            Array.isArray(b) ? (
              <ul key={i} className="mt-0 mb-2 flex list-disc flex-col gap-1 pl-5 text-pretty">
                {b.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="mt-0 mb-2 text-pretty">
                {b}
              </p>
            ),
          )}
        </section>
      ))}
    </div>
  )
}

export function LegalPage({ docId }: { docId: 'privacy' | 'terms' }) {
  const T = useT()
  const lang = useLangStore((s) => s.lang)
  const doc = LEGAL_DOCS[docId]
  const other = LEGAL_DOCS[docId === 'privacy' ? 'terms' : 'privacy']

  return (
    <Page eyebrow={T('Version {v} · effective {date}', { v: LEGAL_VERSION, date: LEGAL_EFFECTIVE })} title={T(doc.title)} description={doc.summary}>
      {lang !== 'en' && <Notice>{T('This document is available in English only.')}</Notice>}
      <LegalBody doc={doc} />
      <p className="mt-8 edge-t pt-4 text-[13px] text-muted-foreground">
        <a href={href({ page: docId === 'privacy' ? 'terms' : 'privacy' })} className="font-semibold text-foreground underline underline-offset-2">
          {T('Read the {title}', { title: T(other.title) })}
        </a>
      </p>
    </Page>
  )
}
