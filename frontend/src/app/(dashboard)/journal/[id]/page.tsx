'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Lock, CheckCircle2, Loader2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/layout/navbar';
import { EmotionBadge } from '@/components/journal/emotion-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getJournalEntry, deleteJournalEntry, correctEmotion, getSimilarEntries } from '@/lib/api/journal';
import { EMOTION_LABELS, EMOTION_COLORS } from '@/types/journal';
import { fadeUp, staggerContainer, staggerItem } from '@/lib/motion';
import type { JournalEntry } from '@/types/journal';

type SimilarEntry = {
  id: string;
  entry_date: string;
  word_count: number;
  similarity: number;
  primary_emotion: string | null;
};

const EMOTIONS = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise'];

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [similar, setSimilar] = useState<SimilarEntry[]>([]);

  useEffect(() => {
    getJournalEntry(id)
      .then((e) => {
        setEntry(e);
        // Load similar entries in background — non-fatal if model unavailable
        getSimilarEntries(id).then(setSimilar).catch(() => {});
      })
      .catch(() => setError('Entry not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJournalEntry(id);
      toast.success('Entry deleted');
      router.push('/dashboard');
    } catch {
      toast.error('Failed to delete entry.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCorrectEmotion = async (emotion: string) => {
    if (!entry) return;
    setCorrecting(true);
    try {
      await correctEmotion(id, emotion);
      const updated = await getJournalEntry(id);
      setEntry(updated);
      toast.success('Emotion updated');
    } catch {
      toast.error('Failed to update emotion.');
    } finally {
      setCorrecting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <Skeleton className="mb-8 h-5 w-24 rounded-lg" />
          <div className="mb-6 flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 rounded-xl" />
              <Skeleton className="h-4 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="mb-6 h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </main>
      </>
    );
  }

  if (error || !entry) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
          >
            <p className="font-medium text-red-700">{error ?? 'Entry not found.'}</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </motion.div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/dashboard"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-6"
        >
          {/* Header */}
          <motion.div variants={staggerItem} className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {format(new Date(entry.entry_date), 'EEEE, MMMM d, yyyy')}
              </h1>
              <p className="mt-1.5 text-sm text-gray-400">{entry.word_count} words</p>
            </div>

            {/* Delete button / confirm */}
            <AnimatePresence mode="wait">
              {showDeleteConfirm ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-gray-500">Are you sure?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete this entry"
                  className="rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Emotion card */}
          {entry.emotion && (
            <motion.div
              variants={staggerItem}
              className="rounded-2xl border border-gray-300 bg-white p-5 shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Detected emotion</span>
                <EmotionBadge emotion={entry.emotion} showConfidence />
              </div>

              {/* Theme tags */}
              {entry.emotion.themes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.emotion.themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              )}

              {/* Emotion correction */}
              {entry.emotion.analysis_status === 'completed' && !entry.emotion.is_user_corrected && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <p className="mb-2.5 text-xs font-medium text-gray-400">
                    Not accurate? Correct it:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EMOTIONS.map((em) => (
                      <motion.button
                        key={em}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCorrectEmotion(em)}
                        disabled={correcting}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 transition-colors"
                      >
                        {correcting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          EMOTION_LABELS[em]
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {entry.emotion.is_user_corrected && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  You corrected this emotion
                </div>
              )}
            </motion.div>
          )}

          {/* Journal content */}
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border border-gray-300 bg-white p-7 shadow"
          >
            <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{entry.content}</p>
          </motion.div>

          {/* Similar entries */}
          {similar.length > 0 && (
            <motion.div variants={staggerItem}>
              <div className="mb-3 flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Similar entries
                </span>
              </div>
              <div className="space-y-2">
                {similar.map((s) => (
                  <Link key={s.id} href={`/journal/${s.id}`}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        {s.primary_emotion && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: EMOTION_COLORS[s.primary_emotion] ?? '#9ca3af' }}
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {format(new Date(s.entry_date), 'EEEE, MMM d')}
                          </p>
                          <p className="text-xs text-gray-400">{s.word_count} words</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(s.similarity * 100)}% similar
                      </span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <motion.p
            variants={staggerItem}
            className="flex items-center justify-center gap-1.5 text-xs text-gray-400"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            Encrypted with your personal key — only you can read this
          </motion.p>
        </motion.div>
      </main>
    </>
  );
}
