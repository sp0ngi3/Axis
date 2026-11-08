// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStandaloneMode, usePwaInstall } from './pwa';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Axis PWA installation', () => {
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
