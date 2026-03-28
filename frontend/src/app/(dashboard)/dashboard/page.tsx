'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlusCircle, TrendingUp, BookOpen, Sparkles, Flame } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { JournalList } from '@/components/journal/journal-list';
import { EmotionDistributionChart, SentimentTimelineChart } from '@/components/journal/emotion-chart';
import { WeeklyInsightCard } from '@/components/journal/weekly-insight-card';
import { MoodCheckin } from '@/components/journal/mood-checkin';
import { MoodTrendChart } from '@/components/journal/mood-trend-chart';
import { WeekComparison } from '@/components/journal/week-comparison';
import { Skeleton } from '@/components/ui/skeleton';
import { listJournalEntries, getInsights, getStreak, getMoodCheckins } from '@/lib/api/journal';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { JournalEntryListItem, WeeklyInsight, MoodCheckin as MoodCheckinData } from '@/types/journal';

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="rounded-2xl border border-gray-300 bg-white p-5 shadow"
    >
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [entries, setEntries] = useState<JournalEntryListItem[]>([]);
  const [insights, setInsights] = useState<WeeklyInsight[]>([]);
  const [streak, setStreak] = useState(0);
  const [checkins, setCheckins] = useState<MoodCheckinData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      listJournalEntries(1, 50),
      getInsights(3, 'weekly'),
      getStreak(),
      getMoodCheckins(30),
    ]).then(([entriesResult, insightsResult, streakResult, checkinsResult]) => {
      if (entriesResult.status === 'fulfilled') setEntries(entriesResult.value.entries);
      if (insightsResult.status === 'fulfilled') setInsights(insightsResult.value);
      if (streakResult.status === 'fulfilled') setStreak(streakResult.value.streak);
      if (checkinsResult.status === 'fulfilled') setCheckins(checkinsResult.value);
    }).finally(() => setLoading(false));
  }, []);

  const completedEntries = entries.filter((e) => e.emotion?.analysis_status === 'completed');
  const dominantEmotion = (() => {
    const counts: Record<string, number> = {};
    completedEntries.forEach((e) => {
      const em = e.emotion?.primary_emotion ?? '';
      if (em && em !== 'pending') counts[em] = (counts[em] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  })();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-gray-500">Your emotional journey at a glance</p>
          </div>
          <Link href="/journal/new">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              New Entry
            </motion.button>
          </Link>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-2xl" />
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Mood Check-in */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-6"
            >
              <MoodCheckin onEntry={(e) => setEntries(prev => [{
                id: e.id,
                word_count: e.word_count,
                entry_date: e.entry_date,
                created_at: e.created_at,
                emotion: e.emotion,
              }, ...prev])} />
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <StatCard label="Total entries" value={entries.length} icon={BookOpen} color="gradient-bg" />
              <StatCard label="This week" value={entries.filter(e => {
                const d = new Date(e.entry_date);
                const now = new Date();
                const diff = (now.getTime() - d.getTime()) / 86400000;
                return diff <= 7;
              }).length} icon={TrendingUp} color="bg-violet-500" />
              <StatCard label="Dominant emotion" value={dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)} icon={Sparkles} color="bg-pink-500" />
              <StatCard label="Day streak" value={streak} icon={Flame} color="bg-orange-500" />
            </motion.div>

            {/* Week-over-week comparison */}
            {(checkins.length > 0 || entries.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="mb-8"
              >
                <WeekComparison checkins={checkins} entries={entries} />
              </motion.div>
            )}

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Charts + Insights column */}
              <div className="space-y-6 lg:col-span-1">
                <motion.section
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Emotion Distribution
                  </h2>
                  <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow">
                    <EmotionDistributionChart entries={entries} />
                  </div>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Mood Trend (14 days)
                  </h2>
                  <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow">
                    <MoodTrendChart checkins={checkins} />
                  </div>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Sentiment Trend
                  </h2>
                  <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow">
                    <SentimentTimelineChart entries={entries} />
                  </div>
                </motion.section>

                {insights.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      Weekly Insights
                    </h2>
                    <div className="space-y-4">
                      {insights.map((insight) => (
                        <WeeklyInsightCard key={insight.id} insight={insight} />
                      ))}
                    </div>
                  </motion.section>
                )}
              </div>

              {/* Entry list */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2"
              >
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Recent Entries
                </h2>
                <JournalList entries={entries.slice(0, 25)} />
              </motion.div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
