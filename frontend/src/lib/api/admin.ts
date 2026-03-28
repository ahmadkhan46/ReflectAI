import { apiRequest } from './client';

export interface PlatformStats {
  total_users: number;
  active_users: number;
  total_entries: number;
  total_insights: number;
  completed_analyses: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  entry_count: number;
  insight_count: number;
  created_at: string;
}

export function getAdminStats(): Promise<PlatformStats> {
  return apiRequest('/api/admin/stats');
}

export function getAdminUsers(page = 1, pageSize = 25): Promise<AdminUserRow[]> {
  return apiRequest(`/api/admin/users?page=${page}&page_size=${pageSize}`);
}

export function toggleUserActive(userId: string): Promise<{ user_id: string; is_active: boolean }> {
  return apiRequest(`/api/admin/users/${userId}/toggle-active`, { method: 'POST' });
}

export function toggleUserAdmin(userId: string): Promise<{ user_id: string; is_admin: boolean }> {
  return apiRequest(`/api/admin/users/${userId}/toggle-admin`, { method: 'POST' });
}

export function adminGenerateInsight(userId: string): Promise<{ message: string; insight_id: string }> {
  return apiRequest(`/api/admin/users/${userId}/generate-insight`, { method: 'POST' });
}
