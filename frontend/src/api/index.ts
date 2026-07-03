import api from './client';

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const projectsApi = {
  list: (page = 1) => api.get('/projects', { params: { page } }).then((r) => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then((r) => r.data),
  create: (name: string, description?: string) =>
    api.post('/projects', { name, description }).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const queuesApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/queues`).then((r) => r.data),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/queues`, data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/queues/${id}`, data).then((r) => r.data),
  stats: (id: string) => api.get(`/queues/${id}/stats`).then((r) => r.data),
};

export const retryPoliciesApi = {
  list: () => api.get('/retry-policies').then((r) => r.data),
};

export const jobsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/jobs', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/jobs/${id}`).then((r) => r.data),
  create: (queueId: string, data: Record<string, unknown>) =>
    api.post(`/queues/${queueId}/jobs`, data).then((r) => r.data),
  retry: (id: string) => api.post(`/jobs/${id}/retry`).then((r) => r.data),
};

export const workersApi = {
  list: () => api.get('/workers').then((r) => r.data),
  get: (id: string) => api.get(`/workers/${id}`).then((r) => r.data),
};

export const dlqApi = {
  list: (page = 1) => api.get('/dlq', { params: { page } }).then((r) => r.data),
};

export const statsApi = {
  system: () => api.get('/stats').then((r) => r.data),
};

export interface QueueOption {
  id: string;
  name: string;
  projectName: string;
}

export async function listAllQueues(): Promise<QueueOption[]> {
  const { projects } = await projectsApi.list(1);
  const results: QueueOption[] = [];
  for (const project of projects) {
    const { queues } = await queuesApi.list(project.id);
    for (const queue of queues) {
      results.push({ id: queue.id, name: queue.name, projectName: project.name });
    }
  }
  return results;
}
