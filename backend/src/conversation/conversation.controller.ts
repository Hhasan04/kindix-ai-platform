import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';

/**
 * ConversationController — read access to a session's stored chat history.
 */
@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('history')
  async history(@Query('sessionId') sessionId?: string) {
    const trimmed = sessionId?.trim();
    if (!trimmed) {
      throw new BadRequestException('sessionId is required');
    }

    const messages = await this.conversationService.getHistory(trimmed);
    if (messages === null) {
      throw new NotFoundException(
        `No conversation found for sessionId ${trimmed}`,
      );
    }

    return messages;
  }
}
