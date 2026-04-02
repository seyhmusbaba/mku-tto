import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('competitions')
export class Competition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  source: string; // tubitak, horizon, kosgeb, kalkınma, diger

  @Column({ nullable: true })
  sourceUrl: string; // kaynak link

  @Column({ nullable: true })
  applyUrl: string; // başvuru linki

  @Column({ nullable: true })
  deadline: string; // son başvuru tarihi

  @Column({ nullable: true })
  startDate: string;

  @Column({ nullable: true })
  budget: string; // destek miktarı (metin — "500.000 ₺'ye kadar")

  @Column({ nullable: true })
  category: string; // araştırma, inovasyon, girişim, uluslararası

  @Column({ default: 'active' })
  status: string; // active, expired, upcoming

  @Column({ default: false })
  isManual: boolean; // admin tarafından mı eklendi?

  @Column({ nullable: true })
  externalId: string; // RSS/API'den gelen benzersiz ID (tekrar kaydetme önleme)

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  notificationSent: boolean; // bildirim gönderildi mi (ileride e-posta için)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
