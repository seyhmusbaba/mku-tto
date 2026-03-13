import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('project_partners')
export class ProjectPartner {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column() projectId: string;

  @Column() name: string;                       // Kurum adı
  @Column({ nullable: true }) type: string;     // university | industry | ngo | government | other
  @Column({ nullable: true }) country: string;  // TR, DE, ...
  @Column({ nullable: true }) contactName: string;
  @Column({ nullable: true }) contactEmail: string;
  @Column({ type: 'real', nullable: true }) contributionBudget: number;
  @Column({ nullable: true }) role: string;     // coordinator | partner | associate
  @Column({ type: 'text', nullable: true }) notes: string;

  @CreateDateColumn() createdAt: Date;
}
