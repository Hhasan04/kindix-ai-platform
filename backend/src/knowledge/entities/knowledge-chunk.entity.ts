import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KnowledgeItem } from './knowledge-item.entity';

/**
 * KnowledgeChunk — a contiguous slice of a KnowledgeItem's text together with
 * its dense embedding. Retrieval matches a query embedding against `embedding`
 * (cosine distance) and returns `content` for citation.
 */
@Entity('knowledge_chunks')
export class KnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => KnowledgeItem, (item) => item.chunks, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  @Index()
  item: KnowledgeItem;

  /** 0-based position of this chunk within its parent item. */
  @Column({ type: 'int', name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  /**
   * BGE-M3 embedding — a pgvector `vector(1024)` column.
   *
   * TypeORM has no native pgvector type, so this column is special:
   *   1. `src/database/register-pgvector-type.ts` teaches the Postgres driver
   *      that `vector` is a valid type (otherwise metadata validation throws).
   *   2. The column is actually created by raw SQL in the migration, never by
   *      `synchronize` (which stays off).
   *
   * Postgres returns `vector` values as the string `'[0.1,0.2,...]'`, so real
   * read/write needs raw SQL or a `ValueTransformer` (string <-> number[]).
   * None is wired yet — hence the loose `string | null` type here.
   */
  @Column({ type: 'vector' as never, length: 1024, nullable: true })
  embedding: string | null;
}
