import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { ProjectPartner } from './project-partner.entity';
import { ProjectMember } from './project-member.entity';
import { ProjectDocument } from './project-document.entity';
import { ProjectReport } from './project-report.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ default: 'other' })
  type: string;

  @Column({ nullable: true })
  faculty: string;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'real', nullable: true })
  budget: number;

  @Column({ nullable: true })
  fundingSource: string;

  @Column({ nullable: true })
  startDate: string;

  @Column({ nullable: true })
  endDate: string;

  @Column({ type: 'text', nullable: true })
  dynamicFieldsJson: string;

  @Column({ type: 'text', nullable: true })
  tagsJson: string;

  @Column({ type: 'text', nullable: true })
  keywordsJson: string;

  @Column({ type: 'text', nullable: true })
  sdgGoalsJson: string;

  @Column({ type: 'text', nullable: true, name: 'legacy_partners_json' })
  legacyPartnersJson: string;

  get dynamicFields(): Record<string, any> {
    try { return this.dynamicFieldsJson ? JSON.parse(this.dynamicFieldsJson) : {}; } catch { return {}; }
  }
  set dynamicFields(val: Record<string, any>) {
    this.dynamicFieldsJson = val ? JSON.stringify(val) : null;
  }

  get tags(): string[] {
    try { return this.tagsJson ? JSON.parse(this.tagsJson) : []; } catch { return []; }
  }
  set tags(val: string[]) {
    this.tagsJson = val ? JSON.stringify(val) : null;
  }

  get keywords(): string[] {
    try { return this.keywordsJson ? JSON.parse(this.keywordsJson) : []; } catch { return []; }
  }
  set keywords(val: string[]) {
    this.keywordsJson = val ? JSON.stringify(val) : null;
  }

  get sdgGoals(): string[] {
    try { return this.sdgGoalsJson ? JSON.parse(this.sdgGoalsJson) : []; } catch { return []; }
  }
  set sdgGoals(val: string[]) {
    this.sdgGoalsJson = val ? JSON.stringify(val) : null;
  }

  // legacy inline partners field (replaced by ProjectPartner entity)
  get legacyPartners(): any[] {
    try { return this.legacyPartnersJson ? JSON.parse(this.legacyPartnersJson) : []; } catch { return []; }
  }
  set legacyPartners(val: any[]) {
    this.legacyPartnersJson = val ? JSON.stringify(val) : null;
  }

  @ManyToOne(() => User, user => user.ownedProjects)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: string;

  @OneToMany(() => ProjectMember, member => member.project, { cascade: true, onDelete: 'CASCADE' })
  members: ProjectMember[];

  @OneToMany(() => ProjectDocument, doc => doc.project, { cascade: true, onDelete: 'CASCADE' })
  documents: ProjectDocument[];

  @OneToMany(() => ProjectReport, report => report.project, { cascade: true, onDelete: 'CASCADE' })
  reports: ProjectReport[];

  @OneToMany(() => ProjectPartner, partner => partner.project, { cascade: true, onDelete: 'CASCADE' })
  partners: ProjectPartner[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
