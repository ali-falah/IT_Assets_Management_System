import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Asset } from '../../assets/entities/asset.entity';

@Entity('statuses')
export class Status {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  colorClass: string;

  @Column({ unique: true })
  slug: string;

  @Column({ default: false })
  isSystem: boolean; // Indicates if this is a core status (Available, Assigned, etc.)

  @OneToMany(() => Asset, asset => asset.status)
  assets: Asset[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
