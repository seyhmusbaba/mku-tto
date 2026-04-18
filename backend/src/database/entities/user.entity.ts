import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Role } from './role.entity';
import { Project } from './project.entity';
import { ProjectMember } from './project-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  faculty: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  avatar: string;

  // Akademik profil
  @Column({ nullable: true })
  orcidId: string;

  @Column({ nullable: true })
  googleScholarId: string;

  @Column({ nullable: true })
  researchGateUrl: string;

  @Column({ nullable: true })
  academiaUrl: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  expertiseArea: string;

  @Column({ type: 'text', nullable: true })
  publicationsJson: string;

  // Scopus entegrasyonu
  @Column({ nullable: true })
  scopusAuthorId: string;

  @Column({ nullable: true, type: 'int' })
  scopusHIndex: number;

  @Column({ nullable: true, type: 'int' })
  scopusCitedBy: number;

  @Column({ nullable: true, type: 'int' })
  scopusDocCount: number;

  @Column({ type: 'text', nullable: true })
  scopusSubjects: string;

  @Column({ nullable: true })
  scopusLastSync: string;

  @Column({ default: 1 })
  isActive: boolean;

  // pending | approved | rejected
  @Column({ default: 'approved' })
  approvalStatus: string;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ nullable: true })
  roleId: string;

  @OneToMany(() => Project, project => project.owner)
  ownedProjects: Project[];

  @OneToMany(() => ProjectMember, member => member.user)
  projectMemberships: ProjectMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
