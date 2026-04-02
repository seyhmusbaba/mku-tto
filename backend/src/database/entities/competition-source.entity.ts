import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('competition_sources')
export class CompetitionSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // Kaynak adı: TÜBİTAK, Horizon Europe...

  @Column()
  url: string; // RSS veya API URL

  @Column({ default: 'rss' })
  type: string; // rss | api | manual

  @Column({ nullable: true })
  description: string;

  @Column({ default: '#1d4ed8' })
  color: string;

  @Column({ default: 'araştırma' })
  defaultCategory: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastFetchedAt: Date;

  @Column({ default: 0 })
  totalFetched: number;

  @CreateDateColumn()
  createdAt: Date;
}
