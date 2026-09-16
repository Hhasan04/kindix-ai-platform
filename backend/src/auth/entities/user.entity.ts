import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'school' | 'admin';

/**
 * User — an authenticated account. `school` accounts self-register via
 * POST /auth/register; `admin` accounts are created out-of-band via
 * POST /auth/register-admin (never exposed in any UI).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'text' })
  role: UserRole;

  @Column({ type: 'text', name: 'school_name', nullable: true })
  schoolName: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  country: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
