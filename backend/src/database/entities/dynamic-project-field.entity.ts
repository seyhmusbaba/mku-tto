import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dynamic_project_fields')
export class DynamicProjectField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  key: string;

  @Column({ nullable: true })
  label: string;

  @Column({ default: 'text' })
  type: string;

  @Column({ type: 'text', nullable: true })
  optionsJson: string;

  get options(): string[] {
    try { return this.optionsJson ? JSON.parse(this.optionsJson) : []; } catch { return []; }
  }
  set options(val: string[]) {
    this.optionsJson = val ? JSON.stringify(val) : null;
  }

  @Column({ default: 0 })
  required: number;

  @Column({ default: 1 })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
