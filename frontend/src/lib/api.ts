import axios from 'axios';

export const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api' });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tto_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/') || error.config?.url?.includes('/settings');
    const isAlreadyOnAuthPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/');
    if (error.response?.status === 401 && typeof window !== 'undefined' && !isAuthEndpoint && !isAlreadyOnAuthPage) {
      localStorage.removeItem('tto_token');
      localStorage.removeItem('tto_user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data: any) => api.post('/auth/change-password', data),
};

export const usersApi = {
  getAll: (params?: any) => api.get('/users', { params }),
  updateAvatar: (avatar: string) => api.put('/users/me/avatar', { avatar }),
  getPending: () => api.get('/users/pending/list'),
  approve: (id: string, roleId?: string) => api.post(`/users/${id}/approve`, { roleId }),
  reject: (id: string, reason?: string) => api.post(`/users/${id}/reject`, { reason }),
  getOne: (id: string) => api.get(`/users/${id}`),
  getUserProjects: (id: string) => api.get(`/users/${id}/projects`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  assignRole: (id: string, roleId: string) => api.post(`/users/${id}/assign-role`, { roleId }),
};

export const rolesApi = {
  getAll: () => api.get('/roles'),
  getOne: (id: string) => api.get(`/roles/${id}`),
  getPermissions: () => api.get('/roles/permissions'),
  create: (data: any) => api.post('/roles', data),
  update: (id: string, data: any) => api.put(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`),
};

export const projectsApi = {
  getAll: (params?: any) => api.get('/projects', { params }),
  getOne: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, data: any) => api.post(`/projects/${id}/members`, data),
  updateMember: (id: string, userId: string, data: any) => api.put(`/projects/${id}/members/${userId}`, data),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
  getSimilar: (id: string) => api.get(`/projects/${id}/similar`),
  getBudgetEstimate: (params: any) => api.get('/projects/budget-estimate', { params }),
};

export const documentsApi = {
  upload: (projectId: string, data: any) => {
    if (data instanceof FormData) {
      return api.post(`/projects/${projectId}/documents`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post(`/projects/${projectId}/documents`, data);
  },
  delete: (projectId: string, docId: string) => api.delete(`/projects/${projectId}/documents/${docId}`),
};

export const reportsApi = {
  getByProject: (projectId: string) => api.get(`/projects/${projectId}/reports`),
  create: (projectId: string, data: any) => api.post(`/projects/${projectId}/reports`, data),
  update: (id: string, data: any) => api.put(`/projects/reports/${id}`, data),
  delete: (id: string) => api.delete(`/projects/reports/${id}`),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export const settingsApi = {
  getAll: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
};

export const dynamicFieldsApi = {
  getAll: () => api.get('/dynamic-fields'),
  getAllAdmin: () => api.get('/dynamic-fields/admin'),
  create: (data: any) => api.post('/dynamic-fields', data),
  update: (id: string, data: any) => api.put(`/dynamic-fields/${id}`, data),
  delete: (id: string) => api.delete(`/dynamic-fields/${id}`),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export const projectTypesApi = {
  getAll: () => api.get('/project-types'),
  getActive: () => api.get('/project-types/active'),
  create: (data: any) => api.post('/project-types', data),
  update: (id: string, data: any) => api.put(`/project-types/${id}`, data),
  delete: (id: string) => api.delete(`/project-types/${id}`),
};

export const reportTypesApi = {
  getAll: () => api.get('/report-types'),
  getActive: () => api.get('/report-types/active'),
  create: (data: any) => api.post('/report-types', data),
  update: (id: string, data: any) => api.put(`/report-types/${id}`, data),
  delete: (id: string) => api.delete(`/report-types/${id}`),
};

export const facultiesApi = {
  getAll: () => api.get('/faculties'),
  getActive: () => api.get('/faculties/active'),
  create: (data: any) => api.post('/faculties', data),
  update: (id: string, data: any) => api.put(`/faculties/${id}`, data),
  delete: (id: string) => api.delete(`/faculties/${id}`),
};

export const partnersApi = {
  getByProject: (projectId: string) => api.get(`/projects/${projectId}/partners`),
  create: (projectId: string, data: any) => api.post(`/projects/${projectId}/partners`, data),
  update: (projectId: string, id: string, data: any) => api.put(`/projects/${projectId}/partners/${id}`, data),
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/partners/${id}`),
};

export const aiApi = {
  getSimilar: (title: string, description: string, excludeId?: string) =>
    api.get('/projects/similar', { params: { title, description, excludeId } }),
  getBudgetStats: (type?: string, faculty?: string) =>
    api.get('/projects/budget-stats', { params: { type, faculty } }),
  extractText: (formData: FormData) =>
    api.post('/ai/extract-text', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const scopusApi = {
  status:                   ()                    => api.get('/scopus/status'),
  getAuthorProfile:         (id: string)          => api.get(`/scopus/author/${id}`),
  getAuthorPublications:    (id: string, limit=20)=> api.get(`/scopus/author/${id}/publications?limit=${limit}`),
  syncMyProfile:            ()                    => api.post('/scopus/sync-my-profile', {}),
  getRelatedPublications:   (projectId: string)   => api.get(`/scopus/project/${projectId}/related-publications`),
  getLinkedPublications:    (projectId: string)   => api.get(`/scopus/project/${projectId}/linked-publications`),
  linkPublication:          (projectId: string, pub: any) => api.post(`/scopus/project/${projectId}/link-publication`, pub),
  unlinkPublication:        (projectId: string, scopusId: string) => api.post(`/scopus/project/${projectId}/unlink-publication`, { scopusId }),
  findSimilarResearch:      (data: any)           => api.post('/scopus/similar-research', data),
  getFundingMatch:          (data: any)           => api.post('/scopus/funding-match', data),
  getFacultyMetrics:        (faculty?: string, department?: string) => api.get('/scopus/faculty-metrics', { params: { faculty, department } }),
};

export const auditApi = {
  getByProject: (projectId: string) => api.get(`/audit/project/${projectId}`),
  getRecent: (limit?: number) => api.get('/audit/recent', { params: limit ? { limit } : {} }),
  /** Role-based feed: akademisyen->kendi, bölüm başkanı->bölüm, dekan->fakülte, admin/rektör->tümü */
  getFeed: (limit?: number) => api.get('/audit/feed', { params: limit ? { limit } : {} }),
  search: (params: any) => api.get('/audit/search', { params }),
};

// ── Manuel yayınlar (profilde kendi yayınını ekleme)
export const userPublicationsApi = {
  listForUser: (userId: string) => api.get(`/user-publications/user/${userId}`),
  listMine:    ()              => api.get('/user-publications/my'),
  create:      (data: any)     => api.post('/user-publications', data),
  update:      (id: string, data: any) => api.put(`/user-publications/${id}`, data),
  remove:      (id: string)    => api.delete(`/user-publications/${id}`),
  toggleFeatured: (id: string) => api.post(`/user-publications/${id}/toggle-featured`, {}),
};

// ── Partners portfolio (tüm projeler arası agregat)
export const partnersPortfolioApi = {
  list:           (params?: any) => api.get('/partners', { params }),
  byOrganization: ()             => api.get('/partners/by-organization'),
  contractsExpiring: ()          => api.get('/partners/contracts-expiring'),
};

// ── Proje lifecycle
export const lifecycleApi = {
  summary:        (pid: string) => api.get(`/projects/${pid}/lifecycle/summary`),
  // Milestones
  listMilestones: (pid: string) => api.get(`/projects/${pid}/lifecycle/milestones`),
  createMs:       (pid: string, data: any) => api.post(`/projects/${pid}/lifecycle/milestones`, data),
  updateMs:       (pid: string, id: string, data: any) => api.put(`/projects/${pid}/lifecycle/milestones/${id}`, data),
  deleteMs:       (pid: string, id: string) => api.delete(`/projects/${pid}/lifecycle/milestones/${id}`),
  // Deliverables
  listDel:        (pid: string) => api.get(`/projects/${pid}/lifecycle/deliverables`),
  createDel:      (pid: string, data: any) => api.post(`/projects/${pid}/lifecycle/deliverables`, data),
  updateDel:      (pid: string, id: string, data: any) => api.put(`/projects/${pid}/lifecycle/deliverables/${id}`, data),
  deleteDel:      (pid: string, id: string) => api.delete(`/projects/${pid}/lifecycle/deliverables/${id}`),
  // Risks
  listRisks:      (pid: string) => api.get(`/projects/${pid}/lifecycle/risks`),
  createRisk:     (pid: string, data: any) => api.post(`/projects/${pid}/lifecycle/risks`, data),
  updateRisk:     (pid: string, id: string, data: any) => api.put(`/projects/${pid}/lifecycle/risks/${id}`, data),
  deleteRisk:     (pid: string, id: string) => api.delete(`/projects/${pid}/lifecycle/risks/${id}`),
};

// ── Bibliyometrik senkronizasyon (OpenAlex + Scopus + TR Dizin)
export const bibliometricsSyncApi = {
  syncUser: (userId: string) => api.post(`/bibliometrics-sync/user/${userId}`, {}),
  syncAll:  ()               => api.post('/bibliometrics-sync/all', {}),
  debugWos: (userId: string) => api.get(`/bibliometrics-sync/debug-wos/${userId}`),
};

// ── Vitrin portalı (public - auth yok)
export const publicApi = {
  institution:        ()                => api.get('/public/institution'),
  stats:              ()                => api.get('/public/stats'),
  faculties:          ()                => api.get('/public/faculties'),
  recent:             ()                => api.get('/public/recent'),
  researchers:        (params?: any)    => api.get('/public/researchers', { params }),
  profile:            (slug: string)    => api.get(`/public/researchers/${slug}`),
  profilePubs:        (slug: string)    => api.get(`/public/researchers/${slug}/publications`),
  profileProjects:    (slug: string)    => api.get(`/public/researchers/${slug}/projects`),
  profileCollaborations: (slug: string) => api.get(`/public/researchers/${slug}/collaborations`),
};

// ── Asistan + Search
export const assistantApi = {
  chat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>, context?: string) =>
    api.post('/ai/assistant', { messages, context }),
};
export const searchApi = {
  search:  (q: string, params?: any) => api.get('/search', { params: { q, ...(params || {}) } }),
  suggest: (q: string)               => api.get('/search/suggest', { params: { q } }),
};

export const analyticsApi = {
  getOverview: (params?: any) => api.get('/analytics/overview', { params }),
  getFacultyPerformance: () => api.get('/analytics/faculty-performance'),
  getResearcherProductivity: (params?: any) => api.get('/analytics/researcher-productivity', { params }),
  getFundingSuccess: () => api.get('/analytics/funding-success'),
  getBudgetUtilization: () => api.get('/analytics/budget-utilization'),
  getTimeline: (params?: any) => api.get('/analytics/timeline', { params }),
};

export const exportApi = {
  downloadCsv: async (params?: any) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tto_token') : '';
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`${base}/export/projects/csv${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    return res.blob();
  },
};
