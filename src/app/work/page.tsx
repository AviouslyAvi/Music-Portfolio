import type { Metadata } from 'next';
import { Section } from '@/components/Section';
import { WORK } from '@/content/copy';
import { TRACKS } from '@/content/tracks';
import { TrackList } from './TrackList';

export const metadata: Metadata = {
  title: 'Work | AVIOUS',
  description: 'Finished tracks by AVIOUS that you can play.',
  openGraph: { title: 'Work | AVIOUS', description: 'Finished tracks by AVIOUS that you can play.', url: '/work' },
};

export default function WorkPage() {
  return (
    <main id="main">
      <header className="page-head">
        <div className="container">
          <p className="eyebrow">Work</p>
          <h1 className="page-title">{WORK.title}</h1>
        </div>
      </header>
      <Section>
        <p className="prose">{WORK.lede}</p>
        <TrackList tracks={TRACKS} />
      </Section>
    </main>
  );
}
