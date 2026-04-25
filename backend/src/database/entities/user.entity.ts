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

  // Web of Science entegrasyonu
  @Column({ nullable: true })
  wosResearcherId: string;

  @Column({ nullable: true, type: 'int' })
  wosHIndex: number;

  @Column({ nullable: true, type: 'int' })
  wosCitedBy: number;

  @Column({ nullable: true, type: 'int' })
  wosDocCount: number;

  @Column({ nullable: true })
  wosLastSync: string;

  // ═════════ AVESİS tarzı kaynak-bazlı metrikler ═════════
  // OpenAlex - ORCID üzerinden otomatik sync, bedava, Scholar'a en yakın kapsam
  // Author ID manuel olarak da set edilebilir (örn. A5012345678)
  @Column({ nullable: true })
  openAlexAuthorId: string;

  @Column({ nullable: true, type: 'int' })
  openAlexHIndex: number;

  @Column({ nullable: true, type: 'int' })
  openAlexCitedBy: number;

  @Column({ nullable: true, type: 'int' })
  openAlexDocCount: number;

  @Column({ nullable: true })
  openAlexLastSync: string;

  // Google Scholar: API yok → manuel girilir (araştırmacı kendi profilinden)
  @Column({ nullable: true, type: 'int' })
  googleScholarHIndex: number;

  @Column({ nullable: true, type: 'int' })
  googleScholarCitedBy: number;

  @Column({ nullable: true, type: 'int' })
  googleScholarDocCount: number;

  // TR Dizin (TÜBİTAK ULAKBİM) - otomatik veya manuel
  @Column({ nullable: true, type: 'int' })
  trDizinHIndex: number;

  @Column({ nullable: true, type: 'int' })
  trDizinCitedBy: number;

  @Column({ nullable: true, type: 'int' })
  trDizinDocCount: number;

  // Sobiad (sosyal bilimler atıf indeksi) - manuel
  @Column({ nullable: true, type: 'int' })
  sobiadHIndex: number;

  @Column({ nullable: true, type: 'int' })
  sobiadCitedBy: number;

  @Column({ nullable: true, type: 'int' })
  sobiadDocCount: number;

  // Diğer kaynaklardan toplam atıf (manuel)
  @Column({ nullable: true, type: 'int' })
  otherCitedBy: number;

  // Tez danışmanlığı sayısı - manuel
  @Column({ nullable: true, type: 'int' })
  thesisAdvisorCount: number;

  // Açık erişim yayın sayısı (farklı kaynaklardan toplanan) - manuel veya hesaplanmış
  @Column({ nullable: true, type: 'int' })
  openAccessCount: number;

  // Toplam yayın sayısı (dedupe'li gerçek sayı) - manuel giriş izinli
  @Column({ nullable: true, type: 'int' })
  totalPublicationCount: number;

  @Column({ default: 1 })
  isActive: boolean;

  // pending | approved | rejected
  @Column({ default: 'approved' })
  approvalStatus: string;

  // ── Vitrin portalı (public) ───────────────────────────────
  /** Kullanıcı profili vitrin portalında görünüyor mu? */
  @Column({ default: true })
  isPublic: boolean;

  /** Vitrin URL'si için benzersiz, ASCII-safe slug (örn: ebru.polat) */
  @Column({ nullable: true, unique: true })
  publicSlug: string;

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
