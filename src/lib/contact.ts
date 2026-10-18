export type ContactInput = {
  name: string;
  email: string;
  message: string;
  link?: string;
  website?: string; // honeypot
};

export type ContactResult = { ok: true } | { ok: false; error: 'invalid' | 'spam' | 'send_failed' };

export type ContactMessage = { subject: string; text: string; replyTo: string };
export type ContactSender = (m: ContactMessage) => Promise<void>;

export const LIMITS = { name: 100, message: 5000, link: 500, email: 254 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() : null;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateContact(
  input: unknown,
): { ok: true; value: ContactInput } | { ok: false; error: 'invalid' } {
  const bad = { ok: false, error: 'invalid' } as const;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return bad;
  const o = input as Record<string, unknown>;

  const name = str(o.name);
  const email = str(o.email);
  const message = str(o.message);
  if (name === null || email === null || message === null) return bad;
  if (name.length < 1 || name.length > LIMITS.name) return bad;
  if (email.length > LIMITS.email || !EMAIL.test(email)) return bad;
  if (message.length < 1 || message.length > LIMITS.message) return bad;

  const value: ContactInput = { name, email, message };

  if (o.link !== undefined && o.link !== null) {
    const link = str(o.link);
    if (link === null) return bad;
    if (link.length > 0) {
      if (link.length > LIMITS.link || !isHttpUrl(link)) return bad;
      value.link = link;
    }
  }
  if (o.website !== undefined && o.website !== null) {
    if (typeof o.website !== 'string') return bad;
    value.website = o.website;
  }
  return { ok: true, value };
}

export async function submitContact(input: unknown, send: ContactSender): Promise<ContactResult> {
  const v = validateContact(input);
  if (!v.ok) return { ok: false, error: 'invalid' };
  const { name, email, message, link, website } = v.value;
  if (website && website.trim().length > 0) return { ok: false, error: 'spam' };

  const cleanName = name.replace(/[\r\n]+/g, ' ');
  const text = [`From: ${cleanName} <${email}>`, link ? `Link: ${link}` : null, '', message]
    .filter((l) => l !== null)
    .join('\n');
  try {
    await send({ subject: `AVIOUS contact: ${cleanName}`, text, replyTo: email });
    return { ok: true };
  } catch {
    return { ok: false, error: 'send_failed' };
  }
}
