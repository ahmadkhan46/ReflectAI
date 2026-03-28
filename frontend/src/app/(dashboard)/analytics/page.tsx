'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  Activity, ArrowLeft, TrendingUp, TrendingDown, Minus,
  Moon, Zap, Brain, Star, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Skeleton } from '@/components/ui/skeleton';
import { getAnalytics, type AnalyticsSnapshot, type Correlation } from '@/lib/api/analytics';
import { EMOTION_COLORS } from '@/types/journal';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

const MOOD_COLOR = (v: number) => {
  if (v >= 4.5) return '#10b981';
  if (v >= 3.5) return '#22c55e';
  if (v >= 2.5) return '#eab308';
  if (v >= 1.5) return '#f97316';
  return '#ef4444';
};

function WellnessGauge({ score, label, trend }: { score: number; label: string; trend: string }) {
  const color = score >= 80 ? '#10b981' : score >= 65 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-500' : trend === 'declining' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="70%" outerRadius="100%"
            startAngle={200} endAngle={-20}
            data={[{ value: score, fill: color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: '#f3f4f6' }} dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-gray-900">{score}</span>
          <span className="text-xs font-medium text-gray-400">/ 100</span>
        </div>
      </div>
      <p className="text-base font-bold" style={{ color }}>{label}</p>
      <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        {trend.charAt(0).toUpperCase() + trend.slice(1)} vs last week
      </div>
    </div>
  );
}

function FactorIcon({ factor }: { factor: string }) {
  if (factor === 'sleep') return <Moon className="h-4 w-4" />;
  if (factor === 'energy') return <Zap className="h-4 w-4" />;
  return <Brain className="h-4 w-4" />;
}

function CorrelationCard({ c }: { c: Correlation }) {
  const positive = c.direction === 'positive' && c.factor !== 'stress';
  const pct = Math.round(Math.abs(c.coefficient) * 100);
  const barColor = positive ? '#22c55e' : c.factor === 'stress' && c.coefficient < 0 ? '#22c55e' : '#ef4444';
  const strengthColor = c.strength === 'strong' ? 'text-emerald-600 bg-emerald-50' : c.strength === 'moderate' ? 'text-amber-600 bg-amber-50' : 'text-gray-500 bg-gray-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-300 bg-white p-4 shadow"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gray-50 p-1.5 text-gray-500">
            <FactorIcon factor={c.factor} />
          </div>
          <span className="text-sm font-semibold capitalize text-gray-800">{c.factor}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${strengthColor}`}>
          {c.strength}
        </span>
      </div>
      {/* Correlation bar */}
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>
      <p className="text-xs leading-relaxed text-gray-500">{c.description}</p>
    </motion.div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const dayChartData = data
    ? DAYS_ORDER
        .filter((d) => data.day_patterns[d])
        .map((d) => ({
          day: DAY_SHORT[d] ?? d,
          mood: data.day_patterns[d].avg_mood,
          count: data.day_patterns[d].count,
          isBest: d === data.best_day,
          isWorst: d === data.worst_day,
        }))
    : [];

  const trendChartData = data?.emotion_trend
    .filter((m) => m.avg_mood !== null)
    .map((m) => ({
      month: m.month.slice(5),
      mood: m.avg_mood,
      emotion: m.dominant_emotion,
    })) ?? [];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          </div>
          <p className="mt-1 text-gray-500">
            Local insights from your data — no external API calls, ever.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="font-medium text-gray-700">Could not load analytics</p>
            <p className="mt-1 text-sm text-gray-400">Make sure the backend is running.</p>
          </div>
        ) : data.total_checkins === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Activity className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="font-medium text-gray-700">No check-in data yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Complete a few daily check-ins and your analytics will appear here.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Log a check-in
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wellness + stats row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="grid gap-4 sm:grid-cols-3"
            >
              {/* Wellness gauge */}
              <div className="flex items-center justify-center rounded-2xl border border-gray-300 bg-white p-6 shadow sm:col-span-1">
                <WellnessGauge
                  score={data.wellness_score}
                  label={data.wellness_label}
                  trend={data.wellness_trend}
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                <StatCard
                  label="7-day mood"
                  value={data.avg_mood_7d !== null ? `${data.avg_mood_7d}/5` : '—'}
                />
                <StatCard
                  label="30-day mood"
                  value={data.avg_mood_30d !== null ? `${data.avg_mood_30d}/5` : '—'}
                />
                <StatCard
                  label="Check-ins"
                  value={String(data.total_checkins)}
                  sub="all time"
                />
                <StatCard
                  label="Entries"
                  value={String(data.total_entries)}
                  sub="all time"
                />
              </div>
            </motion.div>

            {/* Best / worst day badges */}
            {(data.best_day || data.worst_day) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="flex flex-wrap gap-3"
              >
                {data.best_day && (
                  <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-2">
                    <Star className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-700">
                      Best day: <span className="font-semibold">{data.best_day}</span>
                    </span>
                  </div>
                )}
                {data.worst_day && data.worst_day !== data.best_day && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-700">
                      Toughest day: <span className="font-semibold">{data.worst_day}</span>
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Day-of-week patterns */}
            {dayChartData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="rounded-2xl border border-gray-300 bg-white p-6 shadow"
              >
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
                  Day-of-week patterns
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dayChartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)} / 5`, 'Avg mood']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      cursor={{ fill: '#f9fafb' }}
                    />
                    <Bar dataKey="mood" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {dayChartData.map((entry, i) => (
                        <Cell key={i} fill={MOOD_COLOR(entry.mood)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Correlations */}
            {data.correlations.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
                  What affects your mood
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.correlations.map((c) => (
                    <CorrelationCard key={c.factor} c={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Emotion trend */}
            {trendChartData.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="rounded-2xl border border-gray-300 bg-white p-6 shadow"
              >
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
                  Mood over time
                </h2>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={trendChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)} / 5`, 'Avg mood']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="mood" stroke="#6366f1" strokeWidth={2} fill="url(#moodGrad)" dot={{ r: 3, fill: '#6366f1' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* No-data note */}
            {data.correlations.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-gray-400" />
                <p className="text-sm text-gray-500">
                  Log at least 5 check-ins with energy, sleep, and stress ratings to unlock correlation insights.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
