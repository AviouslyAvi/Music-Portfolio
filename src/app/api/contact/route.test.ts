// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { POST } from './route';

const body = { name: 'Ada', email: 'ada@example.com', message: 'hello there' };
const req = (b: string) => new Request('http://x/api/contact', { method: 'POST', body: b });

beforeEach(() => {
  sendMock.mockReset();
  process.env.RESEND_API_KEY = 're_test';
  process.env.CONTACT_TO = 'to@example.com';
  process.env.CONTACT_FROM = 'from@example.com';
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_TO;
  delete process.env.CONTACT_FROM;
});

describe('POST /api/contact', () => {
  it('200 on success', async () => {
    sendMock.mockResolvedValue({ data: { id: '1' }, error: null });
    const res = await POST(req(JSON.stringify(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMock.mock.calls[0][0]).toMatchObject({ to: 'to@example.com', from: 'from@example.com', replyTo: 'ada@example.com' });
  });
  it('500 send_failed when env is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await POST(req(JSON.stringify(body)));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'send_failed' });
    expect(sendMock).not.toHaveBeenCalled();
  });
  it('500 without leaking provider text when sending throws or returns error', async () => {
    sendMock.mockRejectedValueOnce(new Error('secret provider detail'));
    let res = await POST(req(JSON.stringify(body)));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'secret provider detail' } });
    res = await POST(req(JSON.stringify(body)));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'send_failed' });
  });
  it('400 invalid for non-JSON, invalid fields and oversize bodies', async () => {
    for (const b of ['not json', JSON.stringify({ ...body, email: 'nope' }), JSON.stringify({ ...body, message: 'a'.repeat(50000) })]) {
      const res = await POST(req(b));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: 'invalid' });
    }
    expect(sendMock).not.toHaveBeenCalled();
  });
  it('400 spam for honeypot', async () => {
    const res = await POST(req(JSON.stringify({ ...body, website: 'x' })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'spam' });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
