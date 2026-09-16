import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Feedback } from './entities/feedback.entity';
import { Ticket } from './entities/ticket.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

/**
 * DashboardModule — admin-only stats and ticket management, read/resolve
 * only. Feedback and Ticket entities map onto tables owned by the n8n
 * workflows (see /migrations/1788400000000-CreateFeedbackAndTicketTables.ts).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Ticket]), AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
