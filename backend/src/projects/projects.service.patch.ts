// Bu dosya projects.service.ts'e eklenecek metodları içerir
// Mevcut update() metodunu bu versiyonla değiştirin

/*
  Mevcut update() metodunu bulun ve şununla değiştirin.
  AuditService zaten inject edilmiş olmalı (transcript'te eklenmişti).
  NotificationsService de inject edilmiş olmalı.

  Ayrıca mevcut update metoduna rector bildirimi ve detaylı log için
  aşağıdaki kodu entegre edin:
*/

// projects.service.ts içindeki update metoduna eklenecek kısım:
export const UPDATE_METHOD_PATCH = `
  async update(id: string, dto: any, user: any) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!project) throw new NotFoundException('Proje bulunamadı');

    const isAdmin = user.role?.name === 'Süper Admin';
    const isOwner = project.ownerId === user.userId;
    if (!isAdmin && !isOwner) throw new ForbiddenException('Yetkiniz yok');

    // ── Değişen alanları tespit et (audit log için) ──────────
    const changedFields: Record<string, { from: any; to: any }> = {};
    const trackFields = [
      'title', 'description', 'status', 'type', 'faculty', 'department',
      'budget', 'fundingSource', 'startDate', 'endDate',
      'projectText', 'ipStatus', 'ipType', 'ipRegistrationNo',
      'ethicsRequired', 'ethicsApproved', 'ethicsCommittee', 'ethicsApprovalNo',
    ];
    for (const field of trackFields) {
      if (dto[field] !== undefined && String(dto[field]) !== String((project as any)[field])) {
        changedFields[field] = { from: (project as any)[field], to: dto[field] };
      }
    }

    const oldStatus = project.status;
    const oldIpStatus = project.ipStatus;

    // ── Güncelle ─────────────────────────────────────────────
    Object.assign(project, dto);
    if (dto.tags !== undefined) project.tags = dto.tags;
    if (dto.keywords !== undefined) project.keywords = dto.keywords;
    if (dto.sdgGoals !== undefined) project.sdgGoals = dto.sdgGoals;
    if (dto.dynamicFields !== undefined) project.dynamicFields = dto.dynamicFields;

    const updated = await this.projectRepo.save(project);

    // ── Audit log ─────────────────────────────────────────────
    if (Object.keys(changedFields).length > 0) {
      const action = dto.status && dto.status !== oldStatus ? 'status_changed' : 'updated';
      await this.auditService.log({
        entityType: 'project', entityId: id, entityTitle: project.title,
        action, userId: user.userId,
        detail: changedFields,
      });
    }

    // ── Durum değişikliği bildirimleri ────────────────────────
    if (dto.status && dto.status !== oldStatus) {
      const STATUS_LABELS: Record<string,string> = {
        application:'Başvuru', pending:'Beklemede', active:'Aktif',
        completed:'Tamamlandı', suspended:'Askıda', cancelled:'İptal',
      };
      // Ekip üyelerine bildir
      const members = await this.memberRepo.find({ where: { projectId: id }, relations: ['user'] });
      for (const m of members) {
        if (m.userId !== user.userId) {
          await this.notificationsService.create({
            userId: m.userId,
            title: 'Proje Durumu Değişti',
            message: project.title + ': ' + (STATUS_LABELS[oldStatus]||oldStatus) + ' → ' + (STATUS_LABELS[dto.status]||dto.status),
            type: 'info', link: '/projects/' + id,
          }).catch(() => {});
        }
      }
      // Rektöre bildir
      await this.notifyRectors({
        title: '📋 Proje Durum Değişikliği',
        message: project.title + ' projesi ' + (STATUS_LABELS[dto.status]||dto.status) + ' durumuna geçti.',
        link: '/projects/' + id,
        type: dto.status === 'completed' ? 'success' : 'info',
      });
    }

    // ── Fikri Mülkiyet değişikliği ─────────────────────────────
    if (dto.ipStatus && dto.ipStatus !== oldIpStatus && dto.ipStatus !== 'none') {
      const IP_LABELS: Record<string,string> = {
        pending:'Başvuru Aşamasında', registered:'Tescilli', published:'Yayımlandı',
      };
      await this.notifyRectors({
        title: '⚖️ Fikri Mülkiyet Güncellemesi',
        message: project.title + ' - Fikri Mülkiyet: ' + (IP_LABELS[dto.ipStatus]||dto.ipStatus),
        link: '/projects/' + id, type: 'info',
      });
    }

    // ── Etik kurul onayı ──────────────────────────────────────
    if (dto.ethicsApproved === true && !project.ethicsApproved) {
      await this.notifyRectors({
        title: '🔬 Etik Kurul Onayı Alındı',
        message: project.title + ' projesi için etik kurul onayı kaydedildi.',
        link: '/projects/' + id, type: 'success',
      });
    }

    return updated;
  }

  // Rektör rolündeki tüm kullanıcılara bildirim gönder
  private async notifyRectors(notif: { title: string; message: string; link: string; type: string }) {
    try {
      const rectors = await this.userRepo
        .createQueryBuilder('u')
        .innerJoinAndSelect('u.role', 'r')
        .where("r.name ILIKE '%rekt%'")
        .orWhere("r.name ILIKE '%dekan%'")
        .getMany();
      for (const r of rectors) {
        await this.notificationsService.create({
          userId: r.id, ...notif,
        }).catch(() => {});
      }
    } catch {}
  }
`;

// Bu metod yerine kullanacak olan kısım yukarıdadır.
// projects.module.ts'e UserRepository eklendiğinden emin olun:
export const MODULE_NOTE = `
// projects.module.ts'te TypeOrmModule.forFeature içine User ekleyin:
// TypeOrmModule.forFeature([Project, ProjectMember, ProjectDocument, ProjectReport, ProjectPartner, User])
// Ve @InjectRepository(User) private userRepo: Repository<User> constructor'a ekleyin
`;
