// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestBuildId, isStandaloneMode, usePwaInstall } from './pwa';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Axis PWA installation', () => {
  it('reads a fresh build identifier without using the browser cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ buildId: '2026-11-08T10:00:00.000Z' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchLatestBuildId()).resolves.toBe('2026-11-08T10:00:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/build\.json\?checked=\d+$/), { cache: 'no-store' });
    vi.unstubAllGlobals();
  });

  it('detects standalone display mode without assuming matchMedia exists', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    expect(isStandaloneMode()).toBe(false);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  it('captures and completes the browser install prompt', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
    });
    const { result } = renderHook(() => usePwaInstall());

    act(() => window.dispatchEvent(event));
    expect(result.current.canInstall).toBe(true);

    let outcome = 'unavailable';
    await act(async () => {
      outcome = await result.current.requestInstall();
    });

    expect(prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe('accepted');
    expect(result.current.canInstall).toBe(false);
  });
});
