'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarDays, PenLine, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { MoodCalendar } from '@/components/journal/mood-calendar';
import { WeekComparison } from '@/components/journal/week-comparison';
import { Skeleton } from '@/components/ui/skeleton';
import { listJournalEntries, getMoodCheckins } from '@/lib/api/journal';
import type { JournalEntryListItem, MoodCheckin } from '@/types/journal';

export default function CalendarPage() {
  const [entries, setEntries] = useState<JournalEntryListItem[]>([]);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      listJournalEntries(1, 200),
      getMoodCheckins(30),
    ]).then(([entriesResult, checkinsResult]) => {
      if (entriesResult.status === 'fulfilled') setEntries(entriesResult.value.entries);
      if (checkinsResult.status === 'fulfilled') setCheckins(checkinsResult.value);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-10">
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

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl">
                  <CalendarDays className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Mood Calendar</h1>
              </div>
              <p className="text-gray-500">
                Your daily check-ins and entries, month by month.
              </p>
            </div>

            <Link
              href="/journal/new"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
            >
              <PenLine className="h-4 w-4" />
              New Entry
            </Link>
          </div>
        </motion.div>

        {/* Week comparison */}
        {!loading && (checkins.length > 0 || entries.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mb-6"
          >
            <WeekComparison checkins={checkins} entries={entries} />
          </motion.div>
        )}

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-gray-300 bg-white p-6 shadow"
        >
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="mx-auto h-7 w-44 rounded-lg" />
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <MoodCalendar entries={entries} />
          )}
        </motion.div>
      </main>
    </>
  );
}
