import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { DashboardService, DashboardStats, Ticket } from './dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboardComponent implements OnInit {
  protected stats: DashboardStats | null = null;
  protected openTickets: Ticket[] = [];
  protected loading = false;
  protected error: string | null = null;
  protected resolvingId: string | null = null;

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  protected resolve(ticket: Ticket): void {
    if (this.resolvingId) {
      return;
    }

    this.resolvingId = ticket.id;
    this.dashboardService.resolveTicket(ticket.id).subscribe({
      next: () => {
        this.resolvingId = null;
        this.refresh();
      },
      error: () => {
        this.resolvingId = null;
        this.error = 'Could not resolve ticket. Please try again.';
      },
    });
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  private refresh(): void {
    this.loading = true;
    this.error = null;

    this.dashboardService.getStats().subscribe({
      next: (stats) => (this.stats = stats),
      error: () => (this.error = 'Could not load dashboard stats.'),
    });

    this.dashboardService.getTickets().subscribe({
      next: (tickets) => {
        this.openTickets = tickets.filter((ticket) => ticket.status === 'open');
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load tickets.';
        this.loading = false;
      },
    });
  }
}
