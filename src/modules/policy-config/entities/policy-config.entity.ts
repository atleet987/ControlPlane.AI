import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RiskTier } from '../../../common/enums';
import { PolicyThresholds } from '../interfaces/policy.interface';

/**
 * One row per use-case. The gateway resolves a policy by `useCaseId` on every
 * call, so this table is read-mostly and cached in Redis.
 *
 * Column types are deliberately portable: `varchar` rather than a native enum,
 * and `simple-json` rather than a native json column, so the same entity maps
 * onto SQLite (local dev) and MySQL (production) without a second definition.
 */
@Entity('policy_configs')
@Index(['useCaseId', 'version'], { unique: true })
export class PolicyConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'use_case_id', type: 'varchar', length: 128 })
  @Index()
  useCaseId!: string;

  @Column({ type: 'varchar', length: 256 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'risk_tier', type: 'varchar', length: 16, default: RiskTier.MEDIUM })
  riskTier!: RiskTier;

  /** Monotonic per use-case; the highest active version wins. */
  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Which detectors run, and the score at which each escalates. */
  @Column({ type: 'simple-json', nullable: true })
  thresholds!: PolicyThresholds | null;

  @Column({ name: 'slow_path_enabled', type: 'boolean', default: true })
  slowPathEnabled!: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 128, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
