'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Lock, Sparkles, Brain, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { createJournalEntry, reflectOnEntry } from '@/lib/api/journal';
import { ApiError } from '@/lib/api/client';
import { EmotionBadge } from '@/components/journal/emotion-badge';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { JournalEntry } from '@/types/journal';

// ── Voice input hook (Web Speech API — free, 100% browser-native) ─────────────

// webkit prefix shim — not in standard TS lib
type WebkitWindow = Window & { webkitSpeechRecognition?: typeof SpeechRecognition };

function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    );
  }, []);

  const toggle = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition ?? (window as WebkitWindow).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recRef.current?.stop();
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r) => r[0].transcript)
        .join(' ');
      onTranscript(transcript.trim());
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onTranscript]);

  return { listening, supported, toggle };
}

// ── Form schema ───────────────────────────────────────────────────────────────

const PROMPTS = [
  'How are you feeling right now, and what might be causing it?',
  'Describe a moment today that stood out to you.',
  'What is weighing on your mind?',
  'What are you grateful for today?',
  'What would you like to let go of?',
  'How did today make you feel, and why?',
  'One word for today — and why that word?',
  'What drained you today? What gave you energy?',
];

const schema = z.object({
  content: z
    .string()
    .min(1, 'Write something — even one word works')
    .max(10_000, 'Entry exceeds 10,000 characters'),
});

type FormValues = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

export function JournalEntryForm({ onSuccess }: { onSuccess?: (entry: JournalEntry) => void }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  useEffect(() => { setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]); }, []);
  const [charCount, setCharCount] = useState(0);
  const [createdEntry, setCreatedEntry] = useState<JournalEntry | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const sub = watch((v) => setCharCount(v.content?.length ?? 0));
    return sub.unsubscribe;
  }, [watch]);

  // Voice-to-text: append spoken words to the textarea
  const handleTranscript = useCallback((text: string) => {
    const current = getValues('content') ?? '';
    const separator = current.trim() ? ' ' : '';
    setValue('content', current + separator + text, { shouldValidate: true });
    toast.success('Voice added to entry', { duration: 1500 });
  }, [getValues, setValue]);

  const { listening, supported, toggle: toggleVoice } = useVoiceInput(handleTranscript);

  const onSubmit = async (data: FormValues) => {
    try {
      const entry = await createJournalEntry({ content: data.content });
      setCreatedEntry(entry);
      toast.success('Entry saved and encrypted ✓');
      onSuccess?.(entry);

      setReflecting(true);
      reflectOnEntry(entry.id.toString())
        .then((r) => setReflection(r.reflection || null))
        .catch(() => {})
        .finally(() => setReflecting(false));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save. Please try again.';
      toast.error(msg);
    }
  };

  const pct = Math.min((charCount / 10_000) * 100, 100);
  const overLimit = charCount > 9_500;

  if (createdEntry) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100"
          >
            <Sparkles className="h-7 w-7 text-green-600" />
          </motion.div>
          <h3 className="mb-1 font-semibold text-green-800">Entry saved!</h3>
          {createdEntry.emotion && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-green-700">Detected:</span>
              <EmotionBadge emotion={createdEntry.emotion} />
            </div>
          )}
        </div>

        <AnimatePresence>
          {reflecting && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-5"
            >
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-500" />
              <p className="text-sm text-brand-700">Getting a reflection for you…</p>
            </motion.div>
          )}
          {reflection && !reflecting && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-brand-200 bg-brand-50 p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Your reflection
                </span>
              </div>
              <p className="text-sm leading-relaxed text-gray-700">{reflection}</p>
              <p className="mt-3 text-xs text-gray-400">
                Based on emotion patterns — your words were never shared.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setCreatedEntry(null); setReflection(null); }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Write Another
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="gradient-bg rounded-xl px-4 py-2 text-sm font-medium text-white"
          >
            View Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
    >
      {/* Prompt */}
      <motion.div variants={staggerItem}>
        <p className="mb-3 text-sm italic text-gray-400">&ldquo;{prompt}&rdquo;</p>

        <div className="relative">
          <textarea
            {...register('content')}
            rows={12}
            placeholder="Start writing… or tap the mic to speak."
            disabled={isSubmitting}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-gray-900 placeholder:text-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 transition-colors"
            aria-label="Journal entry"
          />

          {/* Voice button — bottom-right of textarea */}
          {supported && (
            <motion.button
              type="button"
              onClick={toggleVoice}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className={[
                'absolute bottom-3 right-3 rounded-xl p-2 transition-colors',
                listening
                  ? 'bg-red-100 text-red-600 shadow-inner ring-2 ring-red-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600',
              ].join(' ')}
              title={listening ? 'Stop recording' : 'Speak your entry (voice-to-text)'}
              aria-label={listening ? 'Stop voice recording' : 'Start voice recording'}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </motion.button>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
            <motion.div
              className={`h-full ${overLimit ? 'bg-red-400' : 'bg-brand-400'}`}
              style={{ width: `${pct}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <AnimatePresence>
            {errors.content && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-500"
                role="alert"
              >
                {errors.content.message}
              </motion.p>
            )}
            {listening && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-xs text-red-500"
              >
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                Listening…
              </motion.p>
            )}
          </AnimatePresence>
          <span className={`ml-auto text-xs ${overLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {charCount.toLocaleString()} / 10,000
          </span>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="h-3 w-3" />
          Encrypted before sending
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isSubmitting}
          className="gradient-bg inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 disabled:opacity-60"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            'Save Entry'
          )}
        </motion.button>
      </motion.div>
    </motion.form>
  );
}
