import { Resend } from 'resend';
import { submitContact, type ContactResult, type ContactSender } from '@/lib/contact';

export const runtime = 'nodejs';

const MAX_BODY_CHARS = 20_000;

function reply(result: ContactResult) {
  if (result.ok) return Response.json({ ok: true }, { status: 200 });
  const status = result.error === 'send_failed' ? 500 : 400;
  return Response.json({ ok: false, error: result.error }, { status });
}

function buildSender(): ContactSender | null {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM;
  if (!apiKey || !to || !from) return null;
  const resend = new Resend(apiKey);
  return async ({ subject, text, replyTo }) => {
    const { error } = await resend.emails.send({ from, to, subject, text, replyTo });
    if (error) throw new Error('send_failed');
  };
}

export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return reply({ ok: false, error: 'invalid' });
    input = JSON.parse(raw);
  } catch {
    return reply({ ok: false, error: 'invalid' });
  }

  const send = buildSender();
  if (!send) {
    // Still reject bad input first so callers get accurate errors.
    return reply(await submitContact(input, async () => {
      throw new Error('not_configured');
    }));
  }
  return reply(await submitContact(input, send));
}
