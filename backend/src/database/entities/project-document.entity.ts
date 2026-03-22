import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';

@Entity('project_documents')
export class ProjectDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  fileName: string;

  @Column()
  filePath: string;

  @Column()
  fileSize: number;

  @Column()
  mimeType: string;

  @Column({ default: 'other' })
  type: string;

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  originalDocumentId: string; // İlk versiyonun ID'si

  @ManyToOne(() => Project, project => project.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
