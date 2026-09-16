import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';

/**
 * ConversationController — read access to the caller's own stored chat
 * history and conversation list.
 */
@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async history(
    @Request() req: { user: JwtPayload },
    @Query('sessionId') sessionId?: string,
  ) {
    const trimmed = sessionId?.trim();
    if (!trimmed) {
      throw new BadRequestException('sessionId is required');
    }

    const messages = await this.conversationService.getHistory(
      trimmed,
      req.user.sub,
    );
    if (messages === null) {
      throw new NotFoundException(
        `No conversation found for sessionId ${trimmed}`,
      );
    }

    return messages;
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async list(@Request() req: { user: JwtPayload }) {
    return this.conversationService.listConversations(req.user.sub);
  }
}
