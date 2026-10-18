'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type NavLinks = { buy: string; account: string };

const INTERNAL = [
  { href: '/work', label: 'Work' },
  { href: '/services', label: 'Services' },
  { href: '/premonition', label: 'Premonition' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Nav({ buy, account }: NavLinks) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container nav-bar">
        <Link href="/" className="wordmark" onClick={() => setOpen(false)}>
          AVIOUS
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav id="primary-nav" aria-label="Primary" className="nav-list" data-open={open}>
          {INTERNAL.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <a href={buy} className="nav-outbound">
            Buy
          </a>
          <a href={account} className="nav-outbound">
            Account
          </a>
        </nav>
        <noscript>
          <style>{`.nav-toggle{display:none}.nav-list{display:flex!important}`}</style>
        </noscript>
      </div>
    </header>
  );
}
