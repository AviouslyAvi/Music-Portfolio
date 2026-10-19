import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { ABOUT, DAWS } from '@/content/copy';

export const metadata: Metadata = {
  title: 'About | AVIOUS',
  description: 'The Alchemist: worlds built from texture, with a human fingerprint.',
  openGraph: { title: 'About | AVIOUS', description: 'The Alchemist: worlds built from texture, with a human fingerprint.', url: '/about' },
};

export default function AboutPage() {
  return (
    <main id="main">
      <header className="page-head">
        <div className="container">
          <p className="eyebrow">About</p>
          <h1 className="page-title">{ABOUT.title}</h1>
          <p className="lede">{ABOUT.lede}</p>
        </div>
      </header>

      <Section>
        <div className="two-col">
          <div className="prose">
            {ABOUT.story.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <dl className="traits">
            {ABOUT.traits.map((t) => (
              <div key={t.label} className="trait">
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section title={ABOUT.motivator.title} tone="warm">
        <p className="prose lede-narrow">{ABOUT.motivator.body}</p>
      </Section>

      <Section title={ABOUT.dawTitle}>
        <p className="prose lede-narrow">{ABOUT.dawBody}</p>
        <ul className="tags">
          {DAWS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Section>

      <Section label="Legacy" tone="warm">
        <blockquote className="big-quote">{ABOUT.legacy.quote}</blockquote>
        <ul className="card-grid grid-3">
          {ABOUT.legacy.pillars.map((p) => (
            <li key={p.title} className="card">
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="cta-row">
          <Link className="btn" href="/contact">
            Get in touch
          </Link>
        </div>
      </Section>
    </main>
  );
}
