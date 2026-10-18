// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { submitContact, validateContact } from './contact';

const good = { name: 'Ada', email: 'ada@example.com', message: 'A rough idea about a slow, warm track.' };

describe('submitContact', () => {
  it('sends once with replyTo set to the visitor email', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const r = await submitContact(good, send);
    expect(r).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].replyTo).toBe('ada@example.com');
    expect(send.mock.calls[0][0].text).toContain(good.message);
  });

  it.each([
    ['empty message', { ...good, message: '' }],
    ['bad email', { ...good, email: 'not-an-email' }],
    ['message over 5000', { ...good, message: 'a'.repeat(5001) }],
    ['javascript link', { ...good, link: 'javascript:alert(1)' }],
    ['empty name', { ...good, name: '' }],
    ['name over 100', { ...good, name: 'n'.repeat(101) }],
    ['non-object', 'hello'],
    ['null', null],
  ])('rejects %s as invalid without sending', async (_l, input) => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await submitContact(input, send)).toEqual({ ok: false, error: 'invalid' });
    expect(send).not.toHaveBeenCalled();
  });

  it('accepts a message of exactly 5000 and an https link', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const r = await submitContact({ ...good, message: 'a'.repeat(5000), link: 'https://example.com/v' }, send);
    expect(r).toEqual({ ok: true });
  });

  it('treats a filled honeypot as spam without sending', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await submitContact({ ...good, website: 'x' }, send)).toEqual({ ok: false, error: 'spam' });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns send_failed when send rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('provider says no'));
    expect(await submitContact(good, send)).toEqual({ ok: false, error: 'send_failed' });
  });

  it('strips line breaks from the subject', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await submitContact({ ...good, name: 'Ada\r\nBcc: x@y.z' }, send);
    expect(send.mock.calls[0][0].subject).not.toMatch(/[\r\n]/);
  });
});

describe('validateContact', () => {
  it('trims fields', () => {
    const r = validateContact({ ...good, name: '  Ada  ' });
    expect(r.ok && r.value.name).toBe('Ada');
  });
});
