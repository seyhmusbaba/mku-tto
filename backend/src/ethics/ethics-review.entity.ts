import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';

@Entity('ethics_reviews')
export class EthicsReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ default: false })
  aiEthicsRequired: boolean;

  @Column({ type: 'text', nullable: true })
  aiEthicsReason: string;

  @Column({ type: 'float', nullable: true })
  aiRiskScore: number;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  reviewerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @Column({ type: 'text', nullable: true })
  reviewNote: string;

  @Column({ nullable: true })
  approvalNumber: string;

  @Column({ nullable: true, type: 'timestamp' })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
