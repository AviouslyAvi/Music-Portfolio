import type { Metadata } from 'next';
import { Section } from '@/components/Section';
import { CONTACT } from '@/content/copy';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact | AVIOUS',
  description: 'Send a link to a voice note, a rough idea, or a mood.',
};

export default function ContactPage() {
  return (
    <main id="main">
      <header className="page-head">
        <div className="container">
          <p className="eyebrow">Contact</p>
          <h1 className="page-title">{CONTACT.title}</h1>
        </div>
      </header>
      <Section>
        <p className="prose">{CONTACT.lede}</p>
        <ContactForm />
      </Section>
    </main>
  );
}
