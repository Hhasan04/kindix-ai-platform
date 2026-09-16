import { Injectable } from '@angular/core';

// Tracks the active session (with an inactivity timeout) and the list of
// chats ever started in this browser, both in localStorage.

export interface ActiveSession {
  sessionId: string;
  savedAt: number;
}

export interface ChatListEntry {
  sessionId: string;
  title: string;
  updatedAt: number;
}

const ACTIVE_SESSION_KEY = 'kindix_active_session';
const CHATS_KEY = 'kindix_chats';
const INACTIVITY_MS = 10 * 60 * 1000;
const TITLE_MAX_LENGTH = 40;

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
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

  getChats(): ChatListEntry[] {
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  upsertChat(sessionId: string, firstMessageText: string): void {
    const chats = this.getChats();
    const existing = chats.find((chat) => chat.sessionId === sessionId);

    if (existing) {
      existing.updatedAt = Date.now();
    } else {
      chats.push({
        sessionId,
        title: firstMessageText.trim().slice(0, TITLE_MAX_LENGTH) || 'New chat',
        updatedAt: Date.now(),
      });
    }

    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }
}
