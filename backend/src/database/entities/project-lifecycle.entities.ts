import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';

/**
 * Proje milestone (kilometre taşı).
 * Örn: "15 Mart Kickoff", "15 Haziran Ara Rapor", "15 Aralık Final Sunum"
 */
@Entity('project_milestones')
export class ProjectMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  @Index()
  projectId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  dueDate: string;

  @Column({ nullable: true })
  completedAt: string;

  /**
   * status: pending | in_progress | completed | delayed | cancelled
   */
  @Column({ default: 'pending' })
  status: string;

  @Column({ default: 0, type: 'int' })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Proje çıktısı (deliverable) - rapor, makale, prototip, sunum vs.
 * Opsiyonel olarak bir milestone'a bağlanabilir.
 */
@Entity('project_deliverables')
export class ProjectDeliverable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  @Index()
  projectId: string;

  @Column({ nullable: true })
  milestoneId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * type: report | publication | prototype | dataset | software |
   *       presentation | patent | other
   */
  @Column({ default: 'report' })
  type: string;

  @Column({ nullable: true })
  dueDate: string;

  @Column({ nullable: true })
  deliveredAt: string;

  /** Belge URL'i (dokuman modülündeki bir dosyaya link veya harici URL) */
  @Column({ nullable: true })
  fileUrl: string;

  /**
   * status: pending | in_progress | submitted | accepted | rejected
   */
  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Proje risk register - risk tanımı, olasılık, etki, mitigasyon.
 */
@Entity('project_risks')
export class ProjectRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  @Index()
  projectId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** probability: low | medium | high */
  @Column({ default: 'medium' })
  probability: string;

  /** impact: low | medium | high */
  @Column({ default: 'medium' })
  impact: string;

  @Column({ type: 'text', nullable: true })
  mitigation: string;

  /** status: open | mitigating | closed */
  @Column({ default: 'open' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
