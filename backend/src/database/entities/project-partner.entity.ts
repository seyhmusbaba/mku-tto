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

  // ═════════ Genişletilmiş alanlar ═════════
  /** tier: strategic | preferred | onetime */
  @Column({ nullable: true }) tier: string;

  /** contractType: joint_research | service | license | sponsorship | consulting | other */
  @Column({ nullable: true }) contractType: string;

  /** Toplam sözleşme değeri (TRY) */
  @Column({ type: 'real', nullable: true }) contractValue: number;

  @Column({ nullable: true }) contractStartDate: string;
  @Column({ nullable: true }) contractEndDate: string;

  /** Sektör - firma odak alanı (manuel): teknoloji, sağlık, imalat, vs. */
  @Column({ nullable: true }) sector: string;

  /** Firma büyüklüğü: micro | small | medium | large */
  @Column({ nullable: true }) size: string;

  @Column({ default: true }) isActive: boolean;

  /** Firma web sitesi / LinkedIn */
  @Column({ nullable: true }) website: string;

  /** Son temas / iletişim tarihi */
  @Column({ nullable: true }) lastContactDate: string;

  @CreateDateColumn() createdAt: Date;
}
