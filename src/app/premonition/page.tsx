import type { Metadata } from 'next';
import { Section } from '@/components/Section';
import { PREMONITION } from '@/content/copy';
import { LINKS } from '@/content/site';
import { PremonitionViewed } from './PremonitionViewed';
import { PremonitionDemoFrame } from './PremonitionDemoFrame';

const DESCRIPTION =
  'PREMONITION is an offline riser renderer for VST3, AU and CLAP. Drop, render, drag. Echoes of the future.';

export const metadata: Metadata = {
  title: 'Premonition | AVIOUS',
  description: DESCRIPTION,
  openGraph: { title: 'PREMONITION | AVIOUS', description: DESCRIPTION, url: '/premonition' },
};

export default function PremonitionPage() {
  return (
    <main id="main">
      <PremonitionViewed />
      <header className="page-head">
        <div className="container">
          <p className="eyebrow">{PREMONITION.tagline}</p>
          <h1 className="page-title wordmark-title">{PREMONITION.wordmark}</h1>
          <p className="lede">{PREMONITION.lede}</p>
          <p className="formats">
            <span className="formats-label">{PREMONITION.formatsLabel}</span> {PREMONITION.formats}
          </p>
        </div>
      </header>
      <Section title={PREMONITION.demoTitle}>
        <p className="prose">{PREMONITION.demoLede}</p>
        <PremonitionDemoFrame />
      </Section>
      <Section tone="warm" title={PREMONITION.stepsTitle}>
        <ol className="card-grid grid-3">
          {PREMONITION.steps.map((s, i) => (
            <li key={s.title} className="card">
              <span className="card-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>
      <section className="section closing">
        <div className="container">
          <h2 className="section-title">{PREMONITION.priceTitle}</h2>
          <p className="prose">{PREMONITION.price}</p>
          <p className="prose">{PREMONITION.priceNote}</p>
          <div className="cta-row">
            <a className="btn" href={LINKS.premonitionStore}>
              {PREMONITION.buy}
            </a>
            <a className="btn btn-ghost" href={LINKS.demoDownload} download>
              {PREMONITION.demo}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
