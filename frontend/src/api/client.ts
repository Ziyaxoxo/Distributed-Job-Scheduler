import axios from 'axios';
const api = axios.create({
  baseURL: 'https://distributed-job-scheduler.getvoroa.com/api',
  headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function getToken() {
  return localStorage.getItem('token');
}
