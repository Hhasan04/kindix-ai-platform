import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KnowledgeChunk } from './knowledge-chunk.entity';

/**
 * KnowledgeItem — a single source document in the knowledge base (help-center
 * article, policy page, FAQ entry, ...). Its text is split into KnowledgeChunk
 * rows that carry the embeddings used for retrieval.
 */
@Entity('knowledge_items')
export class KnowledgeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  /** Free-form category tags (e.g. ['billing', 'refunds']). Postgres `text[]`. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  category: string[];

  /** ISO 639-1 language code of the source content (e.g. 'en', 'de'). */
  @Column({ type: 'varchar', length: 8 })
  language: string;

  /** Canonical URL the article was extracted from, if known. */
  @Column({ type: 'text', name: 'source_url', nullable: true })
  sourceUrl: string | null;

  /** When the underlying source was last known to change. */
  @Column({ type: 'timestamptz', name: 'last_updated', nullable: true })
  lastUpdated: Date | null;

  @OneToMany(() => KnowledgeChunk, (chunk) => chunk.item)
  chunks: KnowledgeChunk[];
}
