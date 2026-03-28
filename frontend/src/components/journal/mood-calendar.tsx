'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import type { MoodCheckin, JournalEntryListItem } from '@/types/journal';
import { getMoodCheckins } from '@/lib/api/journal';
import { Skeleton } from '@/components/ui/skeleton';

const MOOD_CFG = {
  1: { bg: 'bg-red-50', text: 'text-red-500', emoji: '😔', label: 'Rough' },
  2: { bg: 'bg-orange-50', text: 'text-orange-500', emoji: '😕', label: 'Low' },
  3: { bg: 'bg-yellow-50', text: 'text-yellow-600', emoji: '😐', label: 'Okay' },
  4: { bg: 'bg-green-50', text: 'text-green-600', emoji: '🙂', label: 'Good' },
  5: { bg: 'bg-emerald-50', text: 'text-emerald-600', emoji: '😊', label: 'Great' },
} as const;

type MoodScore = keyof typeof MOOD_CFG;

interface Props {
  entries: JournalEntryListItem[];
}

export function MoodCalendar({ entries }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const monthKey = format(currentMonth, 'yyyy-MM');
  const isCurrentMonth = isSameMonth(currentMonth, new Date());
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    getMoodCheckins(31, monthKey)
      .then(setCheckins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monthKey]);

  // Build lookup maps — checkins arrive DESC; only keep the latest per day
  const checkinByDay = new Map<string, MoodCheckin>();
  checkins.forEach((c) => {
    const key = c.checkin_date.slice(0, 10);
    if (!checkinByDay.has(key)) checkinByDay.set(key, c);
  });

  const entriesByDay = new Map<string, number>();
  entries.forEach((e) => {
    const key = e.entry_date.slice(0, 10);
    if (isSameMonth(parseISO(key), currentMonth)) {
      entriesByDay.set(key, (entriesByDay.get(key) ?? 0) + 1);
    }
  });

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });
  const startPad = getDay(monthStart);

  // Monthly stats
  const avgMood =
    checkins.length > 0
      ? checkins.reduce((s, c) => s + c.mood_score, 0) / checkins.length
      : null;
  const monthEntryCount = entries.filter((e) =>
    isSameMonth(parseISO(e.entry_date), currentMonth),
  ).length;

  // Selected day data
  const selectedCheckin = selected ? (checkinByDay.get(selected) ?? null) : null;
  const selectedEntryCount = selected ? (entriesByDay.get(selected) ?? 0) : 0;

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          onClick={() => setCurrentMonth((p) => subMonths(p, 1))}
          className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</p>
          <p className="text-xs text-gray-400">
            {checkins.length} check-in{checkins.length !== 1 ? 's' : ''}
            {avgMood !== null ? ` · avg ${avgMood.toFixed(1)}/5` : ''}
            {monthEntryCount > 0
              ? ` · ${monthEntryCount} entr${monthEntryCount !== 1 ? 'ies' : 'y'}`
              : ''}
          </p>
        </div>

        <button
          onClick={() => setCurrentMonth((p) => addMonths(p, 1))}
          disabled={isCurrentMonth}
          className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-300"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Leading blank pads */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}

          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const checkin = checkinByDay.get(key) ?? null;
            const entryCount = entriesByDay.get(key) ?? 0;
            const cfg = checkin ? MOOD_CFG[checkin.mood_score as MoodScore] : null;
            const isSelected = selected === key;
            const today = isToday(day);
            const future = key > todayStr;

            return (
              <motion.button
                key={key}
                whileHover={!future ? { scale: 1.06 } : {}}
                whileTap={!future ? { scale: 0.94 } : {}}
                onClick={() => !future && setSelected(isSelected ? null : key)}
                disabled={future}
                className={[
                  'relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-all',
                  future ? 'cursor-default opacity-20' : 'cursor-pointer',
                  isSelected ? 'ring-2 ring-brand-400 ring-offset-1' : '',
                  cfg ? cfg.bg : 'bg-gray-50 hover:bg-gray-100',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-[11px] font-semibold leading-none',
                    today
                      ? 'text-brand-600'
                      : cfg
                        ? cfg.text
                        : 'text-gray-400',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </span>

                <span className="text-sm leading-none">
                  {cfg ? cfg.emoji : <span className="h-4 w-4 inline-block opacity-0">·</span>}
                </span>

                {entryCount > 0 && (
                  <span className="flex gap-px">
                    {Array.from({ length: Math.min(entryCount, 3) }).map((_, i) => (
                      <span key={i} className="inline-block h-1 w-1 rounded-full bg-brand-400" />
                    ))}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {(Object.entries(MOOD_CFG) as [string, (typeof MOOD_CFG)[MoodScore]][]).map(
          ([, cfg]) => (
            <span key={cfg.label} className="flex items-center gap-1 text-xs text-gray-400">
              {cfg.emoji} {cfg.label}
            </span>
          ),
        )}
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="flex gap-px">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400" />
          </span>
          Journal entry
        </span>
      </div>

      {/* Selected day detail */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border border-gray-300 bg-white p-4 shadow">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-gray-800">
                  {format(parseISO(selected), 'EEEE, MMMM d')}
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {selectedCheckin ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { label: 'Mood', value: selectedCheckin.mood_score },
                        ...(selectedCheckin.energy_level != null
                          ? [{ label: 'Energy', value: selectedCheckin.energy_level }]
                          : []),
                        ...(selectedCheckin.sleep_quality != null
                          ? [{ label: 'Sleep', value: selectedCheckin.sleep_quality }]
                          : []),
                        ...(selectedCheckin.stress_level != null
                          ? [{ label: 'Stress', value: selectedCheckin.stress_level }]
                          : []),
                      ] as { label: string; value: number }[]
                    ).map(({ label, value }) => {
                      const cfg = MOOD_CFG[value as MoodScore];
                      return (
                        <div key={label} className={`rounded-xl px-3 py-2 ${cfg?.bg ?? 'bg-gray-50'}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            {label}
                          </p>
                          <p className={`text-sm font-bold ${cfg?.text ?? 'text-gray-700'}`}>
                            {cfg?.emoji} {cfg?.label ?? value}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {selectedEntryCount > 0 && (
                    <p className="text-xs text-gray-400">
                      <span className="font-semibold text-brand-600">{selectedEntryCount}</span>{' '}
                      journal entr{selectedEntryCount !== 1 ? 'ies' : 'y'} on this day
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-400">No check-in recorded on this day.</p>
                  {selectedEntryCount > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      <span className="font-semibold text-brand-600">{selectedEntryCount}</span>{' '}
                      journal entr{selectedEntryCount !== 1 ? 'ies' : 'y'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
