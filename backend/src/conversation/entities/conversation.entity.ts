import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from '../../auth/entities/user.entity';

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

  /** Owning user, null for conversations created before auth existed. */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
