import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Asset } from '../../assets/entities/asset.entity';
import { Assignment } from '../../assignments/entities/assignment.entity';
import { UserRole } from '../../user-roles/entities/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  roleId: string;

  @ManyToOne(() => UserRole, { eager: true, nullable: true })
  @JoinColumn({ name: 'roleId' })
  role: UserRole;

  @OneToMany(() => Asset, asset => asset.assignedUser)
  assets: Asset[];

  @OneToMany(() => Assignment, assignment => assignment.user)
  assignments: Assignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
