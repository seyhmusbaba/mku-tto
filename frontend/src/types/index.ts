export interface Permission { id: string; name: string; module: string; action: string; description: string; }
export interface Role { id: string; name: string; description: string; isSystem: number; permissions: Permission[]; }
export interface User { id: string; firstName: string; lastName: string; email: string; phone?: string; title?: string; faculty?: string; department?: string; avatar?: string; isActive: number; role: Role; roleId: string; createdAt: string; updatedAt: string; }
export type ProjectStatus = 'pending' | 'active' | 'completed' | 'suspended' | 'cancelled';
export type ProjectType = 'tubitak' | 'bap' | 'eu' | 'industry' | 'other' | string;
export interface ProjectMember { id: string; userId: string; user: User; role: string; canUpload: number; joinedAt: string; }
export interface ProjectDocument { id: string; name: string; fileName: string; filePath: string; fileSize: number; mimeType: string; type: string; uploadedBy: User; uploadedById: string; createdAt: string; }
export interface ProjectReport { id: string; title: string; content: string; type: string; progressPercent: number; author: User; createdAt: string; updatedAt: string; }
export interface Project { id: string; title: string; description?: string; status: ProjectStatus; type: ProjectType; faculty?: string; department?: string; budget?: number; fundingSource?: string; startDate?: string; endDate?: string; tags: string[]; keywords: string[]; dynamicFields: Record<string, any>; owner: User; ownerId: string; members: ProjectMember[]; documents: ProjectDocument[]; reports: ProjectReport[]; createdAt: string; updatedAt: string; }
export interface DashboardStats { totalProjects: number; activeProjects: number; completedProjects: number; pendingProjects: number; suspendedProjects: number; cancelledProjects: number; totalUsers: number; byType: { type: string; count: string }[]; byFaculty: { faculty: string; count: string }[]; byYear: { year: string; count: string }[]; byStatus: { status: string; count: string }[]; budget: { total: number; avg: number; max: number }; recentProjects: Project[]; }
export interface SystemSetting { id: string; key: string; value: string; label: string; type: string; }
export interface DynamicField { id: string; name: string; key: string; label: string; type: string; options: string[]; required: number; isActive: number; sortOrder: number; }
export interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; totalPages: number; }
export interface Notification { id: string; userId: string; title: string; message: string; type: string; link: string; isRead: number; createdAt: string; }
export interface ProjectTypeItem { id: string; key: string; label: string; color: string; isSystem: number; isActive: number; }
export interface FacultyItem { id: string; name: string; shortName: string; color: string; isActive: number; }

export interface ProjectPartnerItem {
  id: string; projectId: string; name: string; type?: string;
  country?: string; contactName?: string; contactEmail?: string;
  contributionBudget?: number; role?: string; notes?: string; createdAt: string;
}
export interface BudgetStat {
  type: string; faculty?: string; projectCount: string;
  avgBudget: string; minBudget: string; maxBudget: string; avgDurationYears: string;
}
