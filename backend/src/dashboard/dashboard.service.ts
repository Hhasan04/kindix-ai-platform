import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { Ticket } from './entities/ticket.entity';

export interface DashboardStats {
  feedbackUp: number;
  feedbackDown: number;
  ticketsOpen: number;
  ticketsResolved: number;
  ticketsTotal: number;
}

/**
 * DashboardService — read/resolve access onto the feedback and tickets
 * tables owned by the n8n workflows. Never writes feedback, never creates
 * or deletes tickets.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [
      feedbackUp,
      feedbackDown,
      ticketsOpen,
      ticketsResolved,
      ticketsTotal,
    ] = await Promise.all([
      this.feedbackRepository.count({ where: { rating: 'up' } }),
      this.feedbackRepository.count({ where: { rating: 'down' } }),
      this.ticketRepository.count({ where: { status: 'open' } }),
      this.ticketRepository.count({ where: { status: 'resolved' } }),
      this.ticketRepository.count(),
    ]);

    return {
      feedbackUp,
      feedbackDown,
      ticketsOpen,
      ticketsResolved,
      ticketsTotal,
    };
  }

  async listTickets(): Promise<
    {
      id: string;
      reason: string;
      status: string;
      createdAt: Date;
      school: {
        schoolName: string | null;
        email: string;
        phone: string | null;
        country: string | null;
      } | null;
    }[]
  > {
    const tickets = await this.ticketRepository.find({
      relations: { conversation: { user: true } },
      order: { createdAt: 'DESC' },
    });

    return tickets.map((ticket) => {
      const user = ticket.conversation?.user;
      return {
        id: ticket.id,
        reason: ticket.reason,
        status: ticket.status,
        createdAt: ticket.createdAt,
        school: user
          ? {
              schoolName: user.schoolName,
              email: user.email,
              phone: user.phone,
              country: user.country,
            }
          : null,
      };
    });
  }

  async resolveTicket(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`No ticket found for id ${id}`);
    }

    ticket.status = 'resolved';
    return this.ticketRepository.save(ticket);
  }
}
