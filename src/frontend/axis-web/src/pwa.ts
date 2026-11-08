import { useCallback, useEffect, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

type BuildInfo = {
  buildId?: string;
};

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
let updateInProgress = false;

export async function fetchLatestBuildId(): Promise<string | null> {
  const response = await fetch(`/build.json?checked=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const build = await response.json() as BuildInfo;
  return typeof build.buildId === 'string' ? build.buildId : null;
}

function activateNewVersion(latestBuildId?: string) {
  if (updateInProgress) return;
  const previousBuildId = sessionStorage.getItem('axis-reloading-build');
  const previousAttemptAt = Number(sessionStorage.getItem('axis-reloading-at') ?? 0);
  if (latestBuildId && previousBuildId === latestBuildId && Date.now() - previousAttemptAt < 30_000) return;

  updateInProgress = true;
  if (latestBuildId) {
    sessionStorage.setItem('axis-reloading-build', latestBuildId);
    sessionStorage.setItem('axis-reloading-at', Date.now().toString());
  }
  window.dispatchEvent(new CustomEvent('axis:update-ready', { detail: { latestBuildId } }));
  window.setTimeout(() => window.location.reload(), 1200);
}

async function checkForNewBuild() {
  try {
    const latestBuildId = await fetchLatestBuildId();
    if (latestBuildId && latestBuildId !== __AXIS_BUILD_ID__) activateNewVersion(latestBuildId);
    else {
      sessionStorage.removeItem('axis-reloading-build');
      sessionStorage.removeItem('axis-reloading-at');
    }
  } catch {
    // Being offline is normal for an installed PWA. The next focus/online check retries.
  }
}

export function registerAxisServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const checkForUpdates = () => {
        void registration.update();
        void checkForNewBuild();
      };
      checkForUpdates();
      window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
      window.addEventListener('focus', checkForUpdates);
      window.addEventListener('online', checkForUpdates);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdates();
      });
    }).catch((error) => {
      console.warn('Axis offline shell could not be registered.', error);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) activateNewVersion();
    });
  });
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    function captureInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function markInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
    }

    function updateConnectionState() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', markInstalled);
    window.addEventListener('online', updateConnectionState);
    window.addEventListener('offline', updateConnectionState);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', markInstalled);
      window.removeEventListener('online', updateConnectionState);
      window.removeEventListener('offline', updateConnectionState);
    };
  }, []);

  const requestInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!installPrompt) return 'unavailable';
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    return choice.outcome;
  }, [installPrompt]);

  return {
    canInstall: Boolean(installPrompt),
    isInstalled,
    isIos: isIosDevice(),
    isOnline,
    requestInstall
  };
}

export function isStandaloneMode() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  const matchesStandalone = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
  return matchesStandalone || navigatorWithStandalone.standalone === true;
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
