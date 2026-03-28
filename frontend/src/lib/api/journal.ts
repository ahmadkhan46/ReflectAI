import type {
  InsightType,
  JournalEntry,
  JournalEntryCreate,
  JournalEntryListResponse,
  MoodCheckin,
  MoodCheckinCreate,
  WeeklyInsight,
} from '@/types/journal';
import { apiRequest } from './client';

/** Create a new journal entry. */
export async function createJournalEntry(payload: JournalEntryCreate): Promise<JournalEntry> {
  return apiRequest('/api/journal/entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** List journal entries (paginated). */
export async function listJournalEntries(
  page = 1,
  pageSize = 20,
): Promise<JournalEntryListResponse> {
  return apiRequest(`/api/journal/entries?page=${page}&page_size=${pageSize}`);
}

/** Get a single journal entry with decrypted content. */
export async function getJournalEntry(id: string): Promise<JournalEntry> {
  return apiRequest(`/api/journal/entries/${id}`);
}

/** Update journal entry content. */
export async function updateJournalEntry(
  id: string,
  content: string,
): Promise<JournalEntry> {
  return apiRequest(`/api/journal/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** Soft-delete a journal entry. */
export async function deleteJournalEntry(id: string): Promise<void> {
  return apiRequest(`/api/journal/entries/${id}`, { method: 'DELETE' });
}

/** Submit a user emotion correction. */
export async function correctEmotion(
  entryId: string,
  correctedEmotion: string,
): Promise<{ message: string; corrected_emotion: string }> {
  return apiRequest(`/api/journal/entries/${entryId}/emotion`, {
    method: 'PATCH',
    body: JSON.stringify({ corrected_emotion: correctedEmotion }),
  });
}

/** Save a mood check-in. */
export async function createMoodCheckin(payload: MoodCheckinCreate): Promise<MoodCheckin> {
  return apiRequest('/api/journal/checkins', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** List recent mood check-ins. Pass `month` as "YYYY-MM" to filter to a calendar month. */
export async function getMoodCheckins(limit = 30, month?: string): Promise<MoodCheckin[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (month) params.set('month', month);
  return apiRequest(`/api/journal/checkins?${params}`);
}

/** Get AI insights filtered by type. Pass 'all' for the full history. */
export async function getInsights(limit = 10, type: InsightType | 'all' = 'weekly'): Promise<WeeklyInsight[]> {
  return apiRequest(`/api/journal/insights?limit=${limit}&type=${type}`);
}

/** Trigger insight generation for the given type. */
export async function generateInsightNow(type: InsightType = 'weekly'): Promise<WeeklyInsight> {
  return apiRequest(`/api/journal/insights/generate?type=${type}`, { method: 'POST' });
}

/** Submit feedback on an insight. */
export async function submitInsightFeedback(
  insightId: string,
  feedback: 1 | -1,
): Promise<{ message: string }> {
  return apiRequest(`/api/journal/insights/${insightId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  });
}

/** Export all user data as JSON (triggers download). */
export async function exportData(): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/privacy/export`,
    { credentials: 'include' },
  );
  if (!response.ok) throw new Error('Export failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reflectai_export.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Permanently delete account. */
export async function deleteAccount(): Promise<{ message: string }> {
  return apiRequest('/api/privacy/account', { method: 'DELETE' });
}

/** Get current check-in streak. */
export async function getStreak(): Promise<{ streak: number; total_days: number }> {
  return apiRequest('/api/journal/streak');
}

/** Find semantically similar journal entries (requires sentence-transformers on backend). */
export async function getSimilarEntries(
  entryId: string,
  limit = 3,
): Promise<Array<{
  id: string;
  entry_date: string;
  word_count: number;
  similarity: number;
  primary_emotion: string | null;
}>> {
  return apiRequest(`/api/journal/entries/${entryId}/similar?limit=${limit}`);
}

/** Get an instant AI reflection on a saved entry. */
export async function reflectOnEntry(entryId: string): Promise<{
  reflection: string;
  emotion: string;
  sentiment: string;
  themes: string[];
}> {
  return apiRequest(`/api/journal/entries/${entryId}/reflect`, { method: 'POST' });
}
