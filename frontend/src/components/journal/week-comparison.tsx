'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import type { MoodCheckin, JournalEntryListItem } from '@/types/journal';

interface Props {
  checkins: MoodCheckin[];
  entries: JournalEntryListItem[];
}

function avg(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function Trend({ delta }: { delta: number | null }) {
  if (delta === null) return <Minus className="h-3.5 w-3.5 text-gray-300" />;
  if (delta >= 0.2) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (delta <= -0.2) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

function Delta({ value, unit = '' }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="text-[11px] text-gray-300">no prior data</span>;
  const positive = value > 0;
  const neutral = Math.abs(value) < 0.2;
  const color = neutral
    ? 'text-gray-400'
    : positive
      ? 'text-green-600'
      : 'text-red-500';
  return (
    <span className={`text-[11px] font-medium ${color}`}>
      {positive ? '+' : ''}
      {Number.isInteger(value) ? value : value.toFixed(1)}
      {unit} vs last week
    </span>
  );
}

export function WeekComparison({ checkins, entries }: Props) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const sevenAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const fourteenAgoStr = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  // Use date-string comparison — reliable for YYYY-MM-DD format
  const thisWeekC = checkins.filter(
    (c) => c.checkin_date >= sevenAgoStr && c.checkin_date <= todayStr,
  );
  const lastWeekC = checkins.filter(
    (c) => c.checkin_date >= fourteenAgoStr && c.checkin_date < sevenAgoStr,
  );
  const thisWeekE = entries.filter(
    (e) => e.entry_date >= sevenAgoStr && e.entry_date <= todayStr,
  );
  const lastWeekE = entries.filter(
    (e) => e.entry_date >= fourteenAgoStr && e.entry_date < sevenAgoStr,
  );

  const thisMood = avg(thisWeekC.map((c) => c.mood_score));
  const lastMood = avg(lastWeekC.map((c) => c.mood_score));
  const moodDelta = thisMood !== null && lastMood !== null ? thisMood - lastMood : null;
  const entryDelta = lastWeekE.length > 0 ? thisWeekE.length - lastWeekE.length : null;

  // Don't render if there's no useful data at all
  if (checkins.length === 0 && entries.length === 0) return null;

  const stats = [
    {
      label: 'Avg mood',
      value: thisMood !== null ? `${thisMood.toFixed(1)}/5` : '—',
      delta: moodDelta,
      unit: '',
    },
    {
      label: 'Entries',
      value: `${thisWeekE.length}`,
      sub: lastWeekE.length > 0 ? `(was ${lastWeekE.length})` : undefined,
      delta: entryDelta,
      unit: '',
    },
  ] as const;

  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
        This week vs last week
      </p>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-gray-500">{s.label}</span>
              <Trend delta={s.delta} />
            </div>
            <p className="text-xl font-bold text-gray-800">
              {s.value}
              {'sub' in s && s.sub && (
                <span className="ml-1.5 text-sm font-normal text-gray-400">{s.sub}</span>
              )}
            </p>
            <Delta value={s.delta} unit={s.unit} />
          </div>
        ))}
      </div>
    </div>
  );
}
