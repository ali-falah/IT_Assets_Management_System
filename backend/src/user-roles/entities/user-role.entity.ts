import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // 'admin' | 'technician' | 'viewer'

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  colorClass: string; // Tailwind badge class e.g. "bg-indigo-100 text-indigo-700"

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
