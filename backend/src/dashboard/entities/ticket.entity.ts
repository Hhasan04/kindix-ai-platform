import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '../../conversation/entities/conversation.entity';

/**
 * Ticket — mapping onto the `tickets` table, created exclusively by n8n
 * workflows. The dashboard only reads tickets and flips `status` to
 * 'resolved'; it never creates or deletes rows.
 */
@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'uuid', name: 'message_id', nullable: true })
  messageId: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
