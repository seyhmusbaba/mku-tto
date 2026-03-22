import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string; // 'project' | 'user' | 'document' | 'report'

  @Column()
  entityId: string;

  @Column()
  entityTitle: string;

  @Column()
  action: string; // 'created' | 'updated' | 'deleted' | 'status_changed' | 'member_added' etc.

  @Column({ type: 'text', nullable: true })
  detail: string; // JSON string with before/after values

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
