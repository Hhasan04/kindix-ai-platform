import { Injectable } from '@angular/core';

// Tracks the active session (with an inactivity timeout) in localStorage, so
// a page reload can resume it. The chat list itself is fetched fresh from
// the backend (GET /conversation/list) rather than tracked locally, since a
// browser-local list would leak between accounts on a shared machine.

export interface ActiveSession {
  sessionId: string;
  savedAt: number;
}

const ACTIVE_SESSION_KEY = 'kindix_active_session';
const LEGACY_CHATS_KEY = 'kindix_chats';
const INACTIVITY_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  constructor() {
    // One-time purge of the old per-browser chat list, which used to leak
    // every account's chats to anyone sharing the browser.
    localStorage.removeItem(LEGACY_CHATS_KEY);
  }

  getActiveSession(): ActiveSession | null {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ActiveSession>;
      if (typeof parsed.sessionId !== 'string' || typeof parsed.savedAt !== 'number') {
        return null;
      }
      return { sessionId: parsed.sessionId, savedAt: parsed.savedAt };
    } catch {
      return null;
    }
  }

  isFresh(session: ActiveSession): boolean {
    return Date.now() - session.savedAt < INACTIVITY_MS;
  }

  touchActiveSession(sessionId: string): void {
    const session: ActiveSession = { sessionId, savedAt: Date.now() };
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  }

  clearActiveSession(): void {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}
