'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  TrendingUp,
  CalendarDays,
  LayoutGrid,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Navbar } from '@/components/layout/navbar';
import { WeeklyInsightCard } from '@/components/journal/weekly-insight-card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getInsights } from '@/lib/api/journal';
import { ApiError } from '@/lib/api/client';
import type { InsightType, WeeklyInsight } from '@/types/journal';

// ── config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<InsightType, { label: string; icon: React.ReactNode; badgeColor: string; activeTab: string }> = {
  daily: {
    label: 'Daily',
    icon: <Clock className="h-3.5 w-3.5" />,
    badgeColor: 'bg-sky-100 text-sky-700',
    activeTab: 'bg-sky-500 text-white shadow-sky-200',
  },
  weekly: {
    label: 'Weekly',
    icon: <CalendarDays className="h-3.5 w-3.5" />,
    badgeColor: 'bg-brand-100 text-brand-700',
    activeTab: 'bg-brand-600 text-white shadow-brand-200',
  },
  monthly: {
    label: 'Monthly',
    icon: <Calendar className="h-3.5 w-3.5" />,
    badgeColor: 'bg-violet-100 text-violet-700',
    activeTab: 'bg-violet-600 text-white shadow-violet-200',
  },
  yearly: {
    label: 'Yearly',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    badgeColor: 'bg-amber-100 text-amber-700',
    activeTab: 'bg-amber-500 text-white shadow-amber-200',
  },
};

const TABS: Array<{ value: InsightType | 'all'; label: string; icon: React.ReactNode }> = [
  { value: 'all',     label: 'All',     icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: 'daily',   label: 'Daily',   icon: <Clock className="h-3.5 w-3.5" /> },
  { value: 'weekly',  label: 'Weekly',  icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { value: 'monthly', label: 'Monthly', icon: <Calendar className="h-3.5 w-3.5" /> },
  { value: 'yearly',  label: 'Yearly',  icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

/** Group insights by "Month YYYY" label */
function groupByMonth(insights: WeeklyInsight[]): [string, WeeklyInsight[]][] {
  const map = new Map<string, WeeklyInsight[]>();
  for (const insight of insights) {
    const key = format(parseISO(insight.generated_at), 'MMMM yyyy');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(insight);
  }
  return Array.from(map.entries());
}

// ── component ─────────────────────────────────────────────────────────────────

export default function InsightsHistoryPage() {
  const [insights, setInsights] = useState<WeeklyInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<InsightType | 'all'>('all');

  useEffect(() => {
    getInsights(100, 'all')
      .then(setInsights)
      .catch((err: unknown) => {
        setError(true);
        const msg = err instanceof ApiError
          ? err.message
          : 'Could not connect to server. Make sure the backend is running.';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeTab === 'all'
    ? insights
    : insights.filter((i) => i.insight_type === activeTab);

  const grouped = groupByMonth(filtered);

  // Count per type for badges
  const counts: Record<string, number> = { all: insights.length };
  for (const i of insights) {
    counts[i.insight_type] = (counts[i.insight_type] ?? 0) + 1;
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6"
        >
          <Link
            href="/insights"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Insights
          </Link>

          <div className="flex items-center gap-2">
            <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Your Insights</h1>
          </div>
          <p className="mt-1 text-gray-500">
            All your AI-generated insights, grouped by month.
          </p>
        </motion.div>

        {/* Tab bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-7 flex flex-wrap gap-2"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            const count = counts[tab.value] ?? 0;
            const cfg = tab.value !== 'all' ? TYPE_CONFIG[tab.value as InsightType] : null;
            const activeClass = isActive
              ? (cfg ? cfg.activeTab : 'bg-gray-800 text-white shadow-gray-300')
              : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400 hover:text-gray-800';

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-all ${activeClass}`}
              >
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        {error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-12 text-center"
          >
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-red-300" />
            <p className="font-medium text-red-700">Could not load insights</p>
            <p className="mt-1 text-sm text-red-400">
              The backend may need a restart. Check the console for details.
            </p>
          </motion.div>
        ) : loading ? (
          <div className="space-y-8">
            {[0, 1].map((g) => (
              <div key={g}>
                <Skeleton className="mb-4 h-5 w-32 rounded-lg" />
                <div className="space-y-4">
                  {[0, 1].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center"
              >
                <BookOpen className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                <p className="font-medium text-gray-700">No insights found</p>
                <p className="mt-1 text-sm text-gray-400">
                  {activeTab === 'all'
                    ? 'Generate your first insight — even a single mood check-in is enough.'
                    : `No ${activeTab} insights yet. Go to Insights and hit Generate Now.`}
                </p>
                <Link
                  href="/insights"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Go to Insights
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-10"
              >
                {grouped.map(([month, items], gi) => (
                  <motion.section
                    key={month}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: gi * 0.05 }}
                  >
                    {/* Month header */}
                    <div className="mb-4 flex items-center gap-3">
                      <h2 className="text-sm font-semibold text-gray-500">{month}</h2>
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs text-gray-400">
                        {items.length} insight{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Insights list */}
                    <div className="space-y-4">
                      {items.map((insight) => {
                        const cfg = TYPE_CONFIG[insight.insight_type as InsightType] ?? TYPE_CONFIG.weekly;
                        return (
                          <div key={insight.id} className="relative">
                            {/* Type badge — only show in "all" view */}
                            {activeTab === 'all' && (
                              <div className="absolute -top-2.5 left-4 z-10">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badgeColor}`}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                              </div>
                            )}
                            <WeeklyInsightCard insight={insight} />
                          </div>
                        );
                      })}
                    </div>
                  </motion.section>
                ))}

                <p className="text-center text-xs text-gray-400">
                  Showing {filtered.length} insight{filtered.length !== 1 ? 's' : ''} total
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </>
  );
}
