/**
 * Installing the app on the home screen (D9). Android/Chrome offers a native
 * install dialog through `beforeinstallprompt`, which fires once and early, so
 * it is captured at startup (main.tsx) and kept here. iPhone has no such API:
 * the person adds it from Safari's Share menu, which the app explains.
 */
import { useSyncExternalStore } from 'react';

export type InstallPlatform = 'ios' | 'android' | 'other';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Already running as the installed app (or just installed). */
  installed: boolean;
  /** Android/Chrome's native dialog is available. */
  canPrompt: boolean;
  /** The person closed the invitation on this device. */
  dismissed: boolean;
}

const DISMISSED_FLAG = 'pj20-instalar-cerrado';

let deferredPrompt: InstallPromptEvent | null = null;
let state: InstallState = { installed: false, canPrompt: false, dismissed: false };
const listeners = new Set<() => void>();

function update(next: Partial<InstallState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_FLAG) === '1';
  } catch {
    return false; // Storage unavailable (private mode): show it again next time.
  }
}

export function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  // iPadOS presents itself as a Mac; touch gives it away.
  if (userAgent.includes('Macintosh') && maxTouchPoints > 1) return 'ios';
  if (userAgent.includes('Android')) return 'android';
  return 'other';
}

/**
 * Browsers inside other apps (Facebook, Instagram, Gmail, LinkedIn…) cannot
 * add to the home screen: the link has to be opened in Safari or Chrome first.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|GSA\/|Line\/|Snapchat|TikTok|; wv\)/.test(
    userAgent,
  );
}

/** Called once at startup, before React renders. Returns the cleanup. */
export function startInstallCapture(): () => void {
  deferredPrompt = null;
  state = { installed: isStandalone(), canPrompt: false, dismissed: readDismissed() };
  const onPrompt = (event: Event) => {
    event.preventDefault(); // Our own invitation, at the right moment, not Chrome's banner.
    deferredPrompt = event as InstallPromptEvent;
    update({ canPrompt: true });
  };
  const onInstalled = () => {
    deferredPrompt = null;
    update({ installed: true, canPrompt: false });
  };
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

/** Opens Android's native install dialog. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null; // Chrome allows each event to be used once.
  update({ canPrompt: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISSED_FLAG, '1');
  } catch {
    // Not remembered on this device; it only means the card may show again.
  }
  update({ dismissed: true });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface Install extends InstallState {
  platform: InstallPlatform;
  inAppBrowser: boolean;
  /** Worth offering: a phone, not yet installed. */
  available: boolean;
}

export function useInstall(): Install {
  const current = useSyncExternalStore(subscribe, () => state);
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  return {
    ...current,
    platform,
    inAppBrowser: isInAppBrowser(navigator.userAgent),
    available: !current.installed && (platform !== 'other' || current.canPrompt),
  };
}
