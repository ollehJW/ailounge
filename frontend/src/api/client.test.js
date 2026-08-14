import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_EXPIRED_EVENT, apiFetch, resolveApiUrl } from './client';

describe('API client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps already resolved URLs unchanged', () => {
    expect(resolveApiUrl('https://example.com/api/test')).toBe('https://example.com/api/test');
  });

  it('broadcasts authenticated session expiration', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    await apiFetch('/api/auth/me', { headers: { Authorization: 'Bearer token' } });

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it('does not expire the session for an unauthenticated login failure', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    await apiFetch('/api/auth/login', { method: 'POST' });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });
});
