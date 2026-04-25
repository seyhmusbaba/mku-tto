import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Kullanıcının takip ettiği yarışma/çağrı kayıtları.
 * Unique(userId, competitionId) - aynı yarışmayı 2 kez favoriye eklenmez.
 */
@Entity('competition_favorites')
@Index(['userId', 'competitionId'], { unique: true })
export class CompetitionFavorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  competitionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
