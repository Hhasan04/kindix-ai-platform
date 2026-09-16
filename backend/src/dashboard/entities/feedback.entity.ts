import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Feedback — read-only mapping onto the `feedback` table, which is written
 * exclusively by n8n's Postgres node. No relations, no writes from here.
 */
@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'message_id' })
  messageId: string;

  @Column({ type: 'text' })
  rating: string;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
