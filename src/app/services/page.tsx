import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { SERVICES, COLLAB } from '@/content/copy';

export const metadata: Metadata = {
  title: 'Services | AVIOUS',
  description: 'Production and arrangement, sound design, finishing and finalization, teaching and mentorship.',
  openGraph: { title: 'Services | AVIOUS', description: 'Production and arrangement, sound design, finishing and finalization, teaching and mentorship.', url: '/services' },
};

export default function ServicesPage() {
  return (
    <main id="main">
      <header className="page-head">
        <div className="container">
          <p className="eyebrow">Services</p>
          <h1 className="page-title">{SERVICES.title}</h1>
        </div>
      </header>
      <Section>
        <ul className="service-list">
          {SERVICES.items.map((s, i) => (
            <li key={s.title} className="service-row">
              <span className="card-num">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="service-name">{s.title}</h2>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
      </Section>
      <section className="section closing">
        <div className="container">
          <p className="prose">{COLLAB.body}</p>
          <div className="cta-row">
            <Link className="btn" href="/contact">
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
