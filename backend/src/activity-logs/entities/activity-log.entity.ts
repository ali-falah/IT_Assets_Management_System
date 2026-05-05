import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type ActivityAction =
  | 'asset_created'
  | 'asset_updated'
  | 'asset_deleted'
  | 'asset_assigned'
  | 'asset_returned'
  | 'user_created'
  | 'user_deleted';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: ActivityAction;

  /** Human-readable description */
  @Column()
  message: string;

  /** ID of the entity affected (asset id, user id, …) */
  @Column({ nullable: true })
  entityId: string;

  /** Name snapshot at the time of the event */
  @Column({ nullable: true })
  entityName: string;

  /** Secondary entity (e.g., the user an asset was assigned to) */
  @Column({ nullable: true })
  secondaryId: string;

  @Column({ nullable: true })
  secondaryName: string;

  /** Who performed the action (optional – from JWT context) */
  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorName: string;

  /** Extra metadata (old→new category, location change, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
