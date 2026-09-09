import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Message } from './message.entity';

/**
 * Conversation — one chat session, grouping the user/assistant turns
 * exchanged under a given `sessionId`. Storage only: not read back into
 * generation yet.
 */
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Client-supplied (or server-generated) session identifier. */
  @Index()
  @Column({ type: 'text', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
