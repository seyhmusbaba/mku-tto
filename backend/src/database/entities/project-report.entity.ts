import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';

@Entity('project_reports')
export class ProjectReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: 'progress' })
  type: string;

  @Column({ default: 0 })
  progressPercent: number;

  // Tür bazlı ek alanlar (JSON string olarak saklanır)
  @Column({ type: 'text', nullable: true })
  metadata: string;

  @ManyToOne(() => Project, project => project.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
