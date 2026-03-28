'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Sparkles, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { submitInsightFeedback } from '@/lib/api/journal';
import type { WeeklyInsight } from '@/types/journal';

export function WeeklyInsightCard({ insight }: { insight: WeeklyInsight }) {
  const [feedback, setFeedback] = useState<1 | -1 | null>(insight.user_feedback ?? null);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (value: 1 | -1) => {
    if (feedback !== null || submitting) return;
    setSubmitting(true);
    try {
      await submitInsightFeedback(insight.id, value);
      setFeedback(value);
    } catch {
      toast.error('Could not save feedback. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-brand-200 bg-brand-50 p-5"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-brand-700">
            {insight.insight_type
              ? insight.insight_type.charAt(0).toUpperCase() + insight.insight_type.slice(1) + ' Insight'
              : 'Insight'}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {insight.period_label ??
            `${format(new Date(insight.week_start), 'MMM d')}–${format(new Date(insight.week_end), 'MMM d, yyyy')}`}
        </span>
      </div>

      {/* Content */}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {insight.insight_content}
      </p>

      {/* Pattern tags */}
      {insight.patterns_detected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {insight.patterns_detected.map((p, i) => (
            <span
              key={i}
              className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
            >
              {p.value}
            </span>
          ))}
        </div>
      )}

      {/* Footer: privacy note + feedback */}
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-brand-200 pt-3">
        <p className="text-xs text-gray-400">
          Generated from anonymised emotion data — your text was never shared.
        </p>

        <AnimatePresence mode="wait">
          {feedback === null ? (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1"
            >
              <button
                onClick={() => handleFeedback(1)}
                disabled={submitting}
                aria-label="This insight was helpful"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-brand-100 hover:text-brand-600 disabled:opacity-50 transition-colors"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleFeedback(-1)}
                disabled={submitting}
                aria-label="This insight was not helpful"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-brand-100 hover:text-brand-600 disabled:opacity-50 transition-colors"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-xs text-brand-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {feedback === 1 ? 'Helpful' : 'Noted'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
