import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Manual yayın kayıtları - kullanıcıların kendi profillerine
 * ekledikleri yayınlar. OpenAlex/Crossref'den gelen otomatik veriye
 * ek olarak; DOI'siz eski Türkçe yayınlar, kitap bölümleri,
 * proje raporları vb. için kullanılır.
 */
@Entity('user_publications')
export class Publication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  authors: string;  // "Ayşe Yılmaz, Mehmet Demir, John Doe"

  @Column({ nullable: true })
  journal: string;

  @Column({ nullable: true, type: 'int' })
  year: number;

  @Column({ nullable: true })
  doi: string;

  @Column({ nullable: true })
  url: string;

  /**
   * type: article | book | book-chapter | thesis | conference | report | preprint | other
   */
  @Column({ default: 'article' })
  type: string;

  @Column({ nullable: true, type: 'int', default: 0 })
  citations: number;  // manuel girilen atıf sayısı (opsiyonel)

  @Column({ nullable: true })
  quartile: string;  // Q1/Q2/Q3/Q4 - manuel girilebilir

  @Column({ default: false })
  isOpenAccess: boolean;

  @Column({ default: false })
  @Index()
  isFeatured: boolean;  // profilde öne çıkan yayın

  @Column({ type: 'text', nullable: true })
  notes: string;  // kullanıcının özel notu

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
