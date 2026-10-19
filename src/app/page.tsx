import Link from 'next/link';
import { Section } from '@/components/Section';
import { RoomGate } from '@/room/RoomGate';
import { HERO, PHILOSOPHY, EMOTIONAL_PALETTE, SERVICES, COLLAB, PREMONITION, HOME_PREMONITION } from '@/content/copy';

export default function HomePage() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <header className="hero">
          <div className="container hero-inner">
            <p className="eyebrow">{HERO.eyebrow}</p>
            <h1 className="hero-title">{HERO.title}</h1>
            <p className="hero-sub">{HERO.sub}</p>
            <div className="cta-row">
              <Link className="btn" href="/contact">
                Work with me
              </Link>
              <Link className="btn btn-ghost" href="/work">
                Hear the work
              </Link>
            </div>
          </div>
        </header>

        <section className="section statement">
          <div className="container">
            <blockquote className="big-quote">{HERO.quote}</blockquote>
          </div>
        </section>

        <Section label="Philosophy" title={PHILOSOPHY.title} tone="warm">
          <ol className="card-grid grid-2">
            {PHILOSOPHY.cards.map((c, i) => (
              <li key={c.title} className="card">
                <span className="card-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section label="Emotional palette" title={EMOTIONAL_PALETTE.title}>
          <ul className="tags">
            {EMOTIONAL_PALETTE.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="prose lede-narrow">{EMOTIONAL_PALETTE.body}</p>
        </Section>

        <Section label="What I do" title={SERVICES.title} tone="warm">
          <ul className="card-grid grid-2">
            {SERVICES.items.map((s) => (
              <li key={s.title} className="card">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ul>
          <p className="more">
            <Link href="/services">All services</Link>
          </p>
        </Section>

        <section className="section home-plugin" aria-labelledby="home-premonition">
          <div className="container">
            <p className="eyebrow">{HOME_PREMONITION.label}</p>
            <h2 id="home-premonition" className="section-title wordmark-title">
              {PREMONITION.wordmark}
            </h2>
            <p className="home-plugin-tagline">{PREMONITION.tagline}</p>
            <p className="prose">{HOME_PREMONITION.body}</p>
            <div className="cta-row">
              <Link className="btn" href="/premonition">
                {HOME_PREMONITION.cta}
              </Link>
            </div>
          </div>
        </section>

        <section className="section closing">
          <div className="container">
            <h2 className="section-title">{COLLAB.title}</h2>
            <p className="prose">{COLLAB.body}</p>
            <div className="cta-row">
              <Link className="btn" href="/contact">
                Get in touch
              </Link>
            </div>
          </div>
        </section>
      </main>
      <RoomGate />
    </>
  );
}
