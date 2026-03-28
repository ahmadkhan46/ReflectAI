'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Zap, Loader2, Calendar, Clock, CalendarDays, TrendingUp, BookOpen, Flame, PenLine, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Navbar } from '@/components/layout/navbar';
import { WeeklyInsightCard } from '@/components/journal/weekly-insight-card';
import { Skeleton } from '@/components/ui/skeleton';
import { getInsights, generateInsightNow, getStreak } from '@/lib/api/journal';
import { ApiError } from '@/lib/api/client';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { InsightType, WeeklyInsight } from '@/types/journal';

const TABS: { type: InsightType; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    type: 'daily',
    label: 'Daily',
    icon: <Clock className="h-4 w-4" />,
    desc: "Today's emotional snapshot",
  },
  {
    type: 'weekly',
    label: 'Weekly',
    icon: <CalendarDays className="h-4 w-4" />,
    desc: 'This week at a glance',
  },
  {
    type: 'monthly',
    label: 'Monthly',
    icon: <Calendar className="h-4 w-4" />,
    desc: 'Monthly patterns',
  },
  {
    type: 'yearly',
    label: 'Yearly',
    icon: <TrendingUp className="h-4 w-4" />,
    desc: 'Year in review',
  },
];

export default function InsightsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InsightType>('weekly');
  const [insightsByType, setInsightsByType] = useState<Record<InsightType, WeeklyInsight[]>>({
    daily: [],
    weekly: [],
    monthly: [],
    yearly: [],
  });
  const [loading, setLoading] = useState<Record<InsightType, boolean>>({
    daily: false,
    weekly: true,
    monthly: false,
    yearly: false,
  });
  const [generating, setGenerating] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);

  const loadInsights = useCallback(async (type: InsightType) => {
    if (insightsByType[type].length > 0) return; // already loaded
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      const data = await getInsights(20, type);
      setInsightsByType((prev) => ({ ...prev, [type]: data }));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Cannot connect to server. Make sure the backend is running.');
      }
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  }, [insightsByType]);

  useEffect(() => {
    loadInsights('weekly');
    getStreak()
      .then((s) => setStreak(s.streak))
      .catch(() => {}); // non-fatal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // loadInsights memoizes on insightsByType, but we only want this to fire once on
  // mount to load the default tab. Subsequent loads are triggered by handleTabChange.
  }, []);

  function handleTabChange(type: InsightType) {
    setActiveTab(type);
    loadInsights(type);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateInsightNow(activeTab);
      // Re-fetch the list so upserted insights (same period) don't duplicate
      const data = await getInsights(20, activeTab);
      setInsightsByType((prev) => ({ ...prev, [activeTab]: data }));
      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} insight generated!`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Cannot connect to server. Make sure the backend is running.');
      }
    } finally {
      setGenerating(false);
    }
  }

  const isLoading = loading[activeTab];
  const insights = insightsByType[activeTab];
  const activeTabInfo = TABS.find((t) => t.type === activeTab)!;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Insights</h1>
            </div>
            <p className="text-gray-500">
              AI-generated summaries of your emotional patterns — based on anonymised data only.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {streak !== null && streak > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-600">
                <Flame className="h-4 w-4" />
                {streak} day streak
              </div>
            )}
            <Link
              href="/insights/history"
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
            >
              <BookOpen className="h-4 w-4" />
              All Insights
            </Link>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {generating ? 'Generating…' : 'Generate Now'}
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => handleTabChange(tab.type)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === tab.type
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Tab description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-5 text-sm text-gray-400"
          >
            {activeTabInfo.desc}
          </motion.p>
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
            </motion.div>
          ) : insights.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                <Brain className="h-7 w-7 text-brand-500" />
              </div>
              <h2 className="mb-2 font-semibold text-gray-900">
                No {activeTab} insights yet
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                To get your first insight, do one of these:
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  <CheckSquare className="h-4 w-4 text-brand-500" />
                  Do a check-in
                </button>
                <Link
                  href="/journal/new"
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  <PenLine className="h-4 w-4 text-violet-500" />
                  Write a journal entry
                </Link>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Generate from existing data
                </button>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                Even a single check-in is enough.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {insights.map((insight) => (
                <motion.div key={insight.id} variants={staggerItem} layout>
                  <WeeklyInsightCard insight={insight} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
