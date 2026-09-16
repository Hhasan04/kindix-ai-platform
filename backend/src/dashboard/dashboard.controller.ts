import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

/**
 * DashboardController — admin-only read/resolve view onto feedback and
 * tickets, for the customer-service dashboard.
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('tickets')
  listTickets() {
    return this.dashboardService.listTickets();
  }

  @Patch('tickets/:id/resolve')
  resolveTicket(@Param('id') id: string) {
    return this.dashboardService.resolveTicket(id);
  }
}
