'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, BookOpen, Sparkles, Brain, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/layout/navbar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getAdminStats,
  getAdminUsers,
  toggleUserActive,
  toggleUserAdmin,
  adminGenerateInsight,
  type PlatformStats,
  type AdminUserRow,
} from '@/lib/api/admin';

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([getAdminStats(), getAdminUsers(p)]);
      setStats(s);
      setUsers(u);
      setPage(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  async function handleToggleActive(userId: string) {
    setActionLoading(userId + '-active');
    try {
      const res = await toggleUserActive(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: res.is_active } : u));
      toast.success(`User ${res.is_active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleAdmin(userId: string) {
    setActionLoading(userId + '-admin');
    try {
      const res = await toggleUserAdmin(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_admin: res.is_admin } : u));
      toast.success(`Admin ${res.is_admin ? 'granted' : 'revoked'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGenerateInsight(userId: string) {
    setActionLoading(userId + '-insight');
    try {
      await adminGenerateInsight(userId);
      toast.success('Insight generated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Platform overview — no journal content is visible here</p>
          </div>
        </div>

        {/* Stats */}
        {loading && !stats ? (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard icon={Users} label="Total Users" value={stats.total_users} color="bg-brand-500" />
            <StatCard icon={Users} label="Active Users" value={stats.active_users} color="bg-emerald-500" />
            <StatCard icon={BookOpen} label="Total Entries" value={stats.total_entries} color="bg-blue-500" />
            <StatCard icon={Sparkles} label="Insights" value={stats.total_insights} color="bg-purple-500" />
            <StatCard icon={Brain} label="Analyses Done" value={stats.completed_analyses} color="bg-orange-500" />
          </div>
        )}

        {/* Users table */}
        <div className="rounded-2xl border border-gray-300 bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Users</h2>
            <button
              onClick={() => load(page)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-6 py-3">User</th>
                  <th className="px-4 py-3">Entries</th>
                  <th className="px-4 py-3">Insights</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{user.entry_count}</td>
                        <td className="px-4 py-3 text-gray-600">{user.insight_count}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.is_admin && (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Admin</span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {user.is_verified && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Verified</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleToggleActive(user.id)}
                              disabled={actionLoading === user.id + '-active'}
                              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleToggleAdmin(user.id)}
                              disabled={actionLoading === user.id + '-admin'}
                              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                            </button>
                            <button
                              onClick={() => handleGenerateInsight(user.id)}
                              disabled={actionLoading === user.id + '-insight'}
                              className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                            >
                              {actionLoading === user.id + '-insight' ? 'Generating…' : 'Gen Insight'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && users.length === 25 && (
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
              <button
                onClick={() => load(page - 1)}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => load(page + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
