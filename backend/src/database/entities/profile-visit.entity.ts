import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('profile_visits')
export class ProfileVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileUserId: string; // Ziyaret edilen kişi

  @Column({ nullable: true })
  visitorUserId: string; // Ziyaret eden kişi

  @ManyToOne(() => User, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'visitorUserId' })
  visitor: User;

  @CreateDateColumn()
  visitedAt: Date;
}
