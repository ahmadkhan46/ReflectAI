'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { EMOTION_COLORS, EMOTION_LABELS } from '@/types/journal';
import type { JournalEntryListItem } from '@/types/journal';

interface EmotionDistributionProps {
  entries: JournalEntryListItem[];
}

export function EmotionDistributionChart({ entries }: EmotionDistributionProps) {
  const completed = entries.filter(
    (e) => e.emotion?.analysis_status === 'completed',
  );

  const counts: Record<string, number> = {};
  for (const e of completed) {
    const em = e.emotion?.primary_emotion ?? 'neutral';
    counts[em] = (counts[em] ?? 0) + 1;
  }

  const data = Object.entries(counts).map(([name, value]) => ({
    name: EMOTION_LABELS[name] ?? name,
    value,
    color: EMOTION_COLORS[name] ?? '#9ca3af',
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Not enough data yet — write more entries to see your emotion distribution.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
          aria-label="Emotion distribution pie chart"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [value, name]}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface SentimentTimelineProps {
  entries: JournalEntryListItem[];
}

const SENTIMENT_VALUES: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

export function SentimentTimelineChart({ entries }: SentimentTimelineProps) {
  const completed = entries
    .filter((e) => e.emotion?.analysis_status === 'completed' && e.emotion.sentiment_label)
    .slice()
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .slice(-30); // last 30 entries

  const data = completed.map((e) => ({
    date: new Date(e.entry_date).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' }),
    sentiment: SENTIMENT_VALUES[e.emotion?.sentiment_label ?? 'neutral'] ?? 0,
  }));

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Write at least 2 entries to see your sentiment trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          ticks={[-1, 0, 1]}
          tickFormatter={(v) => ({ '-1': '😔', '0': '😐', '1': '😊' }[String(v)] ?? '')}
          tick={{ fontSize: 14 }}
          width={30}
        />
        <Tooltip
          formatter={(v: number) =>
            [{ '-1': 'Negative', '0': 'Neutral', '1': 'Positive' }[String(v)] ?? v, 'Sentiment']
          }
        />
        <Line
          type="monotone"
          dataKey="sentiment"
          stroke="#4c6ef5"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
