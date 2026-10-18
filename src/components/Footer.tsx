import Link from 'next/link';
import { LINKS } from '@/content/site';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="footer-name">AVIOUS</span>
        <nav aria-label="Footer" className="footer-nav">
          <Link href="/work">Work</Link>
          <Link href="/services">Services</Link>
          <Link href="/premonition">Premonition</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <a href={LINKS.aviousCo}>avious.co</a>
        </nav>
        <p className="footer-note">&copy; AVIOUS</p>
      </div>
    </footer>
  );
}
