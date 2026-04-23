import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Eğitim programı — atölye, seminer, kurs.
 */
@Entity('training_programs')
export class TrainingProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** type: workshop | seminar | course | webinar | certification */
  @Column({ default: 'workshop' })
  type: string;

  @Column({ nullable: true })
  instructor: string;

  @Column()
  startDate: string;

  @Column({ nullable: true })
  endDate: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  onlineUrl: string;  // Zoom / Teams linki

  @Column({ type: 'int', default: 30 })
  maxParticipants: number;

  @Column({ nullable: true })
  category: string;  // IP eğitimi, Proje yazma, Patent, vs.

  @Column({ type: 'text', nullable: true })
  prerequisites: string;

  @Column({ type: 'text', nullable: true })
  materialsUrl: string;  // ders materyali link

  /** status: upcoming | ongoing | completed | cancelled */
  @Column({ default: 'upcoming' })
  @Index()
  status: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Kullanıcı kaydı — programa kayıt + katılım takibi.
 */
@Entity('training_registrations')
@Index(['userId', 'programId'], { unique: true })
export class TrainingRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  programId: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  attended: boolean;

  @Column({ default: false })
  certificateIssued: boolean;

  @Column({ nullable: true })
  certificateUrl: string;

  @Column({ type: 'int', nullable: true })
  rating: number;  // 1-5 kullanıcı geri bildirimi

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @CreateDateColumn()
  createdAt: Date;
}
