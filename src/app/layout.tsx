import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { LINKS, SITE_URL } from '@/content/site';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const DESCRIPTION =
  'AVIOUS: production and arrangement, sound design, finishing and finalization, teaching and mentorship, and the PREMONITION plugin.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'AVIOUS',
  description: DESCRIPTION,
  openGraph: {
    title: 'AVIOUS',
    description: DESCRIPTION,
    url: '/',
    siteName: 'AVIOUS',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Nav buy={LINKS.premonitionStore} account={LINKS.premonitionAccount} />
        {children}
        <Footer />
      </body>
    </html>
  );
}
