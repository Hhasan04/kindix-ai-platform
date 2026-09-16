import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Talks to the NestJS admin dashboard endpoints (feedback/ticket stats).

export interface DashboardStats {
  feedbackUp: number;
  feedbackDown: number;
  ticketsOpen: number;
  ticketsResolved: number;
  ticketsTotal: number;
}

export interface TicketSchool {
  schoolName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
}

export interface Ticket {
  id: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
  school: TicketSchool | null;
}

const STATS_URL = 'http://localhost:3000/dashboard/stats';
const TICKETS_URL = 'http://localhost:3000/dashboard/tickets';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(STATS_URL);
  }

  getTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(TICKETS_URL);
  }

  resolveTicket(id: string): Observable<Ticket> {
    return this.http.patch<Ticket>(`${TICKETS_URL}/${id}/resolve`, {});
  }
}
