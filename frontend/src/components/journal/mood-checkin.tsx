'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Brain, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { createMoodCheckin, reflectOnEntry, createJournalEntry } from '@/lib/api/journal';
import type { JournalEntry } from '@/types/journal';

// ── Step definitions ─────────────────────────────────────────────────────────

const MOODS = [
  { score: 1, emoji: '😔', label: 'Rough' },
  { score: 2, emoji: '😕', label: 'Low' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😊', label: 'Great' },
];

const ENERGY = [
  { score: 1, emoji: '🪫', label: 'Drained' },
  { score: 2, emoji: '😴', label: 'Tired' },
  { score: 3, emoji: '😑', label: 'Moderate' },
  { score: 4, emoji: '⚡', label: 'Good' },
  { score: 5, emoji: '🔥', label: 'Energised' },
];

const SLEEP = [
  { score: 1, emoji: '😩', label: 'Poor' },
  { score: 2, emoji: '😪', label: 'Restless' },
  { score: 3, emoji: '😶', label: 'Okay' },
  { score: 4, emoji: '😌', label: 'Good' },
  { score: 5, emoji: '🌟', label: 'Great' },
];

const STRESS = [
  { score: 1, emoji: '🧘', label: 'Calm' },
  { score: 2, emoji: '😊', label: 'Mild' },
  { score: 3, emoji: '😬', label: 'Moderate' },
  { score: 4, emoji: '😰', label: 'High' },
  { score: 5, emoji: '🤯', label: 'Maxed' },
];

interface Props {
  onEntry?: (entry: JournalEntry) => void;
}

type Step = 'mood' | 'energy' | 'sleep' | 'stress' | 'note' | 'done';

const STEPS: Step[] = ['mood', 'energy', 'sleep', 'stress', 'note'];

const STEP_QUESTIONS: Record<Step, string> = {
  mood:   'How are you feeling?',
  energy: 'How is your energy?',
  sleep:  'How did you sleep?',
  stress: 'Stress level today?',
  note:   'Anything on your mind?',
  done:   '',
};

export function MoodCheckin({ onEntry }: Props) {
  const [step, setStep] = useState<Step>('mood');
  const [direction, setDirection] = useState(1);

  const [moodScore, setMoodScore]     = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [note, setNote]               = useState('');

  const [saving, setSaving]       = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);

  function advance(nextStep: Step) {
    setDirection(1);
    setStep(nextStep);
  }

  function handleMoodSelect(score: number) {
    setMoodScore(score);
    advance('energy');
  }
  function handleEnergySelect(score: number) {
    setEnergyLevel(score);
    advance('sleep');
  }
  function handleSleepSelect(score: number) {
    setSleepQuality(score);
    advance('stress');
  }
  function handleStressSelect(score: number) {
    setStressLevel(score);
    advance('note');
  }

  async function handleSubmit() {
    if (moodScore === null) return;
    setSaving(true);
    try {
      await createMoodCheckin({
        mood_score: moodScore,
        energy_level: energyLevel ?? undefined,
        sleep_quality: sleepQuality ?? undefined,
        stress_level: stressLevel ?? undefined,
        note: note.trim() || undefined,
      });

      // Also create a lightweight journal entry so the streak / entry count is updated
      // and we can trigger a reflection via the existing reflect endpoint
      const MOOD_TEXT: Record<number, string> = {
        1: 'Having a rough time right now.',
        2: 'Feeling a bit low today.',
        3: 'Just okay — nothing special.',
        4: 'Feeling pretty good today.',
        5: 'Feeling great!',
      };
      const entryText = note.trim()
        ? `${MOOD_TEXT[moodScore]} ${note.trim()}`
        : MOOD_TEXT[moodScore];

      const entry = await createJournalEntry({ content: entryText });
      onEntry?.(entry);
      toast.success('Check-in saved ✓');
      advance('done');

      // Instant AI reflection (non-blocking)
      setReflecting(true);
      reflectOnEntry(entry.id)
        .then((r) => setReflection(r.reflection || null))
        .catch(() => {})
        .finally(() => setReflecting(false));
    } catch {
      toast.error('Could not save check-in');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep('mood');
    setMoodScore(null);
    setEnergyLevel(null);
    setSleepQuality(null);
    setStressLevel(null);
    setNote('');
    setReflection(null);
  }

  const stepIndex = STEPS.indexOf(step);
  const progressPct = step === 'done' ? 100 : ((stepIndex) / STEPS.length) * 100;

  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {step === 'done' ? 'Check-in saved!' : STEP_QUESTIONS[step]}
        </p>
        {step !== 'mood' && step !== 'done' && (
          <button onClick={reset} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        )}
        {step === 'done' && (
          <button onClick={reset} className="text-xs text-brand-500 hover:underline">
            New check-in
          </button>
        )}
      </div>

      {/* Progress bar */}
      {step !== 'done' && (
        <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className="gradient-bg h-full rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        {/* ── Mood step ───────────────────────────────────────────── */}
        {step === 'mood' && (
          <ScaleRow key="mood" items={MOODS} selected={moodScore} onSelect={handleMoodSelect} />
        )}

        {/* ── Energy step ─────────────────────────────────────────── */}
        {step === 'energy' && (
          <motion.div key="energy" {...slideProps(direction)}>
            <ScaleRow items={ENERGY} selected={energyLevel} onSelect={handleEnergySelect} />
            <SkipButton onSkip={() => { setEnergyLevel(null); advance('sleep'); }} />
          </motion.div>
        )}

        {/* ── Sleep step ──────────────────────────────────────────── */}
        {step === 'sleep' && (
          <motion.div key="sleep" {...slideProps(direction)}>
            <ScaleRow items={SLEEP} selected={sleepQuality} onSelect={handleSleepSelect} />
            <SkipButton onSkip={() => { setSleepQuality(null); advance('stress'); }} />
          </motion.div>
        )}

        {/* ── Stress step ─────────────────────────────────────────── */}
        {step === 'stress' && (
          <motion.div key="stress" {...slideProps(direction)}>
            <ScaleRow items={STRESS} selected={stressLevel} onSelect={handleStressSelect} />
            <SkipButton onSkip={() => { setStressLevel(null); advance('note'); }} />
          </motion.div>
        )}

        {/* ── Note step ───────────────────────────────────────────── */}
        {step === 'note' && (
          <motion.div key="note" {...slideProps(direction)}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — a few words is fine…"
              maxLength={500}
              rows={3}
              className="mb-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="gradient-bg flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save Check-in'}
            </button>
          </motion.div>
        )}

        {/* ── Done / reflection ────────────────────────────────────── */}
        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {reflecting && (
              <div className="flex items-center gap-2 text-sm text-brand-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting your reflection…
              </div>
            )}
            {reflection && !reflecting && (
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-brand-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    Reflection
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{reflection}</p>
                <p className="mt-2 text-xs text-gray-400">Your words were never shared with AI.</p>
              </div>
            )}
            {!reflecting && !reflection && (
              <p className="text-sm text-green-600">Check-in complete ✓</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface ScaleItem { score: number; emoji: string; label: string }

function ScaleRow({
  items,
  selected,
  onSelect,
}: {
  items: ScaleItem[];
  selected: number | null;
  onSelect: (score: number) => void;
}) {
  return (
    <motion.div
      className="flex justify-between gap-1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {items.map((item) => (
        <motion.button
          key={item.score}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => onSelect(item.score)}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-colors ${
            selected === item.score
              ? 'bg-brand-50 ring-2 ring-brand-400'
              : 'hover:bg-gray-50'
          }`}
        >
          <span className="text-2xl">{item.emoji}</span>
          <span className="text-[10px] text-gray-500">{item.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600"
    >
      Skip this question →
    </button>
  );
}

function slideProps(direction: number) {
  return {
    initial: { opacity: 0, x: direction * 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -20 },
    transition: { duration: 0.2 },
  };
}
