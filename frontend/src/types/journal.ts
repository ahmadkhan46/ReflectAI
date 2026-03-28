/** Emotion analysis result attached to a journal entry */
export interface EmotionAnalysis {
  id: string;
  primary_emotion: string;
  primary_confidence: number;
  emotion_scores: Record<string, number>;
  sentiment_label: string;
  sentiment_score: number;
  themes: string[];
  is_user_corrected: boolean;
  user_corrected_emotion: string | null;
  analysis_status: 'pending' | 'completed' | 'failed';
  analyzed_at: string | null;
}

/** Full journal entry (with decrypted content) */
export interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  word_count: number;
  entry_date: string;
  created_at: string;
  updated_at: string;
  emotion: EmotionAnalysis | null;
}

/** List item — no content field */
export interface JournalEntryListItem {
  id: string;
  word_count: number;
  entry_date: string;
  created_at: string;
  emotion: EmotionAnalysis | null;
}

/** Paginated list response */
export interface JournalEntryListResponse {
  entries: JournalEntryListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** Create payload */
export interface JournalEntryCreate {
  content: string;
  entry_date?: string;
}

/** Mood check-in */
export interface MoodCheckin {
  id: string;
  mood_score: number;
  energy_level: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  checkin_date: string;
  created_at: string;
}

export interface MoodCheckinCreate {
  mood_score: number;
  energy_level?: number;
  sleep_quality?: number;
  stress_level?: number;
  note?: string;
}

/** AI-generated insight (daily / weekly / monthly / yearly) */
export interface WeeklyInsight {
  id: string;
  insight_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  week_start: string;
  week_end: string;
  period_label: string | null;
  insight_content: string;
  emotion_summary: Record<string, unknown>;
  patterns_detected: Array<{ type: string; value: string }>;
  generated_at: string;
  user_feedback: 1 | -1 | null;
}

export type InsightType = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Emotion color mapping */
export const EMOTION_COLORS: Record<string, string> = {
  joy: '#facc15',
  sadness: '#60a5fa',
  anger: '#f87171',
  fear: '#a78bfa',
  disgust: '#4ade80',
  surprise: '#fb923c',
  neutral: '#9ca3af',
  pending: '#d1d5db',
};

export const EMOTION_LABELS: Record<string, string> = {
  joy: 'Joy',
  sadness: 'Sadness',
  anger: 'Anger',
  fear: 'Fear',
  disgust: 'Disgust',
  surprise: 'Surprise',
  neutral: 'Neutral',
  pending: 'Analysing…',
};
