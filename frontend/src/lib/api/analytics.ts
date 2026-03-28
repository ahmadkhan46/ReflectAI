import { apiRequest } from './client';

export interface DayPattern {
  avg_mood: number;
  count: number;
}

export interface Correlation {
  factor: 'sleep' | 'energy' | 'stress';
  coefficient: number;
  strength: 'strong' | 'moderate' | 'weak';
  direction: 'positive' | 'negative';
  description: string;
}

export interface EmotionTrendMonth {
  month: string;
  avg_mood: number | null;
  dominant_emotion: string | null;
  entry_count: number;
  checkin_count: number;
}

export interface AnalyticsSnapshot {
  wellness_score: number;
  wellness_trend: 'improving' | 'stable' | 'declining';
  wellness_label: string;
  avg_mood_7d: number | null;
  avg_mood_30d: number | null;
  total_checkins: number;
  total_entries: number;
  day_patterns: Record<string, DayPattern>;
  correlations: Correlation[];
  best_day: string | null;
  worst_day: string | null;
  emotion_trend: EmotionTrendMonth[];
}

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  return apiRequest<AnalyticsSnapshot>('/api/analytics');
}
