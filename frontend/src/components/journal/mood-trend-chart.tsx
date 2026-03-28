'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { MoodCheckin } from '@/types/journal';

interface Props {
  checkins: MoodCheckin[];
}

const MOOD_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

export function MoodTrendChart({ checkins }: Props) {
  if (checkins.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No mood check-ins yet — complete a check-in to see your trend.
      </div>
    );
  }

  const sorted = [...checkins]
    .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date))
    .slice(-14);

  const data = sorted.map((c) => ({
    date: format(parseISO(c.checkin_date), 'MMM d'),
    mood: c.mood_score,
    label: MOOD_LABELS[c.mood_score] ?? String(c.mood_score),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4c6ef5" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4c6ef5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tickFormatter={(v: number) => MOOD_LABELS[v] ?? ''}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          width={38}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [MOOD_LABELS[value] ?? value, 'Mood']}
          contentStyle={{ fontSize: 12, borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}
          labelStyle={{ color: '#374151', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="mood"
          stroke="#4c6ef5"
          strokeWidth={2}
          fill="url(#moodGradient)"
          dot={<Dot r={4} fill="#4c6ef5" strokeWidth={0} />}
          activeDot={{ r: 6, fill: '#4c6ef5' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
