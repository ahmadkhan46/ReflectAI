'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { FileText, ChevronRight, Search } from 'lucide-react';
import { EmotionBadge } from './emotion-badge';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { EMOTION_LABELS, EMOTION_COLORS } from '@/types/journal';
import type { JournalEntryListItem } from '@/types/journal';

const EMOTION_ORDER = ['joy', 'sadness', 'anger', 'fear', 'disgust', 'surprise', 'neutral'];

export function JournalList({ entries }: { entries: JournalEntryListItem[] }) {
  const [query, setQuery] = useState('');
  const [emotionFilter, setEmotionFilter] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center"
      >
        <FileText className="mx-auto mb-3 h-10 w-10 text-gray-200" aria-hidden="true" />
        <p className="font-medium text-gray-400">No entries yet</p>
        <p className="mt-1 text-sm text-gray-300">Start by writing your first journal entry.</p>
      </motion.div>
    );
  }

  // Emotions that actually appear in the current entry set
  const presentEmotions = EMOTION_ORDER.filter((em) =>
    entries.some(
      (e) =>
        e.emotion?.analysis_status === 'completed' &&
        e.emotion?.primary_emotion === em,
    ),
  );

  const filtered = entries.filter((e) => {
    const dateStr = format(new Date(e.entry_date), 'EEEE, MMM d').toLowerCase();
    const matchesSearch = !query.trim() || dateStr.includes(query.toLowerCase());
    const matchesEmotion =
      !emotionFilter || e.emotion?.primary_emotion === emotionFilter;
    return matchesSearch && matchesEmotion;
  });

  return (
    <div className="space-y-3">
      {entries.length > 3 && (
        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by date…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Emotion filter pills */}
          {presentEmotions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setEmotionFilter(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !emotionFilter
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {presentEmotions.map((em) => (
                <button
                  key={em}
                  onClick={() => setEmotionFilter(emotionFilter === em ? null : em)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    emotionFilter === em
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  style={
                    emotionFilter === em
                      ? { backgroundColor: EMOTION_COLORS[em] ?? '#6366f1' }
                      : {}
                  }
                >
                  {EMOTION_LABELS[em] ?? em}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center"
          >
            <Search className="mx-auto mb-3 h-8 w-8 text-gray-200" aria-hidden="true" />
            <p className="font-medium text-gray-400">No entries match</p>
            <button
              onClick={() => {
                setQuery('');
                setEmotionFilter(null);
              }}
              className="mt-2 text-sm text-brand-500 hover:underline"
            >
              Clear filters
            </button>
          </motion.div>
        ) : (
          <motion.ul
            key="list"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white"
            role="list"
          >
            {filtered.map((entry) => (
              <motion.li key={entry.id} variants={staggerItem}>
                <Link href={`/journal/${entry.id}`}>
                  <motion.div
                    whileHover={{ backgroundColor: '#f8fafc' }}
                    className="flex items-center justify-between px-5 py-4 transition-colors"
                    aria-label={`Journal entry from ${entry.entry_date}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {format(new Date(entry.entry_date), 'EEEE, MMM d')}
                        </p>
                        <p className="text-sm text-gray-400">{entry.word_count} words</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {entry.emotion && <EmotionBadge emotion={entry.emotion} />}
                      <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden="true" />
                    </div>
                  </motion.div>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
