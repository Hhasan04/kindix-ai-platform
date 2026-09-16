import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SessionStoreService } from '../chat/session-store.service';

// Stores the JWT, decodes its payload client-side for role-based routing,
// and talks to the NestJS auth endpoints. The signature is never verified
// here -- that's the backend's job; we only read the role to route.

export type UserRole = 'school' | 'admin';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  schoolName: string | null;
  exp?: number;
}

export interface AuthResponse {
  access_token: string;
}

export interface RegisterSchoolPayload {
  schoolName: string;
  email: string;
  phone: string;
  country: string;
  password: string;
}

const LOGIN_URL = 'http://localhost:3000/auth/login';
const REGISTER_URL = 'http://localhost:3000/auth/register';
const TOKEN_KEY = 'kindix_auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private readonly http: HttpClient,
    private readonly sessionStore: SessionStoreService,
  ) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(LOGIN_URL, { email, password });
  }

  register(payload: RegisterSchoolPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(REGISTER_URL, payload);
  }

  // Called after both login and register succeed. Clears any active session
  // left over from a previous account on this browser -- switching accounts
  // must never auto-resume someone else's chat session.
  storeToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.sessionStore.clearActiveSession();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getPayload(): JwtPayload | null {
    const token = this.getToken();
    return token ? decodeJwtPayload(token) : null;
  }

  getRole(): UserRole | null {
    return this.getPayload()?.role ?? null;
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.sessionStore.clearActiveSession();
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const base64Url = token.split('.')[1];
  if (!base64Url) {
    return null;
  }

  try {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
