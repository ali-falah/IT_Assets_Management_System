import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Location } from '../../locations/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import { Assignment } from '../../assignments/entities/assignment.entity';
import { Maintenance } from '../../maintenance/entities/maintenance.entity';
import { Status } from '../../statuses/entities/status.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  serialNumber: string;

  @ManyToOne(() => Status, status => status.assets, { nullable: false })
  @JoinColumn({ name: 'statusId' })
  status: Status;

  @Column()
  statusId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastTransactionDate: Date;

  @ManyToOne(() => Category, category => category.assets, { nullable: false })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  categoryId: string;

  @ManyToOne(() => Location, location => location.assets, { nullable: false })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column()
  locationId: string;

  @ManyToOne(() => User, user => user.assets, { nullable: true })
  @JoinColumn({ name: 'assignedUserId' })
  assignedUser: User;

  @Column({ nullable: true })
  assignedUserId: string | null;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => Assignment, assignment => assignment.asset)
  assignments: Assignment[];

  @OneToMany(() => Maintenance, maintenance => maintenance.asset)
  maintenanceLogs: Maintenance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
