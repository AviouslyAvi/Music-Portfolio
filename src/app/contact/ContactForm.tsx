'use client';

import { useRef, useState } from 'react';
import { CONTACT } from '@/content/copy';
import { validateContact } from '@/lib/contact';

type Fields = { name: string; email: string; message: string; link: string; website: string };
type FieldErrors = Partial<Record<'name' | 'email' | 'message' | 'link', string>>;
type Status = 'idle' | 'pending' | 'sent' | 'error';

function fieldErrors(f: Fields): FieldErrors {
  const e: FieldErrors = {};
  const check = (key: keyof FieldErrors, probe: Record<string, string>) => {
    const base = { name: 'a', email: 'a@b.co', message: 'a' };
    if (!validateContact({ ...base, ...probe }).ok) e[key] = CONTACT.errors[key];
  };
  check('name', { name: f.name });
  check('email', { email: f.email });
  check('message', { message: f.message });
  if (f.link.trim()) check('link', { link: f.link });
  return e;
}

export function ContactForm() {
  const [fields, setFields] = useState<Fields>({ name: '', email: '', message: '', link: '', website: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const inFlight = useRef(false);

  const set = (k: keyof Fields) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: ev.target.value }));

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (inFlight.current) return;
    const errs = fieldErrors(fields);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    inFlight.current = true;
    setStatus('pending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (res.ok && data?.ok) {
        setStatus('sent');
        setFields({ name: '', email: '', message: '', link: '', website: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }

  if (status === 'sent') {
    return (
      <p className="form-success" role="status">
        {CONTACT.success}
      </p>
    );
  }

  const pending = status === 'pending';
  const L = CONTACT.labels;

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      <p className="form-hint">{CONTACT.invitation}</p>

      <div className="field">
        <label htmlFor="cf-name">{L.name}</label>
        <input id="cf-name" name="name" autoComplete="name" value={fields.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'cf-name-err' : undefined} />
        {errors.name && <p id="cf-name-err" className="field-error">{errors.name}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-email">{L.email}</label>
        <input id="cf-email" name="email" type="email" autoComplete="email" value={fields.email} onChange={set('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'cf-email-err' : undefined} />
        {errors.email && <p id="cf-email-err" className="field-error">{errors.email}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-message">{L.message}</label>
        <textarea id="cf-message" name="message" rows={6} value={fields.message} onChange={set('message')} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'cf-message-err' : undefined} />
        {errors.message && <p id="cf-message-err" className="field-error">{errors.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-link">{L.link}</label>
        <input id="cf-link" name="link" type="url" inputMode="url" value={fields.link} onChange={set('link')} aria-invalid={!!errors.link} aria-describedby={errors.link ? 'cf-link-err' : undefined} />
        {errors.link && <p id="cf-link-err" className="field-error">{errors.link}</p>}
      </div>

      <div className="hp" aria-hidden="true">
        <label htmlFor="cf-website">Website</label>
        <input id="cf-website" name="website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={set('website')} />
      </div>

      {status === 'error' && (
        <p className="field-error" role="alert">
          {CONTACT.errors.send}
        </p>
      )}

      <div className="cta-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? L.pending : L.submit}
        </button>
      </div>
    </form>
  );
}
