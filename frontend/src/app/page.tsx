'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Shield, Brain, BarChart3, Lock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { staggerContainer, staggerItem, fadeUp } from '@/lib/motion';

const FLOATING_EMOTIONS = [
  { label: 'Joy', color: '#facc15', x: '8%', y: '20%', delay: 0 },
  { label: 'Calm', color: '#60a5fa', x: '85%', y: '15%', delay: 0.8 },
  { label: 'Hopeful', color: '#4ade80', x: '75%', y: '65%', delay: 1.4 },
  { label: 'Curious', color: '#fb923c', x: '12%', y: '72%', delay: 0.4 },
  { label: 'Peaceful', color: '#a78bfa', x: '50%', y: '8%', delay: 1.1 },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Insights',
    description:
      'Weekly pattern summaries generated from your emotion trends — never from your raw words.',
    gradient: 'from-brand-500 to-violet-500',
  },
  {
    icon: Lock,
    title: 'End-to-End Encrypted',
    description:
      'Fernet encryption with per-user PBKDF2-derived keys. Even the platform cannot read your entries.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Emotion Visualisation',
    description:
      'Interactive timelines and trend charts reveal patterns across days, weeks, and months.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'GDPR-aware. Export or hard-delete all data anytime. Zero third-party data sharing.',
    gradient: 'from-pink-500 to-rose-500',
  },
];

const STEPS = [
  { num: '01', title: 'Write freely', body: 'Journal how you truly feel — no judgement, fully private.' },
  { num: '02', title: 'AI detects emotion', body: 'Local ML models analyse tone and themes without leaving your device.' },
  { num: '03', title: 'See your patterns', body: 'Interactive charts reveal emotional trends over time.' },
  { num: '04', title: 'Receive insights', body: 'Claude generates a weekly summary from anonymised statistics — not your words.' },
];

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white p-6 shadow-sm"
    >
      {/* Gradient glow on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-5`} />

      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient}`}>
        <feature.icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>

      <h3 className="mb-2 font-semibold text-gray-900">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{feature.description}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, -80]);

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-6">

        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),transparent)]" />
          <div className="absolute left-1/4 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400/10 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-violet-400/10 blur-3xl" />
        </div>

        {/* Floating emotion tags */}
        {FLOATING_EMOTIONS.map((em) => (
          <motion.div
            key={em.label}
            className="absolute hidden lg:block"
            style={{ left: em.x, top: em.y }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.7, scale: 1 }}
            transition={{ delay: em.delay + 0.8, duration: 0.6, ease: 'backOut' }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4 + em.delay, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm"
              style={{
                borderColor: em.color + '40',
                backgroundColor: em.color + '15',
                color: em.color,
              }}
            >
              {em.label}
            </motion.div>
          </motion.div>
        ))}

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 mx-auto max-w-4xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Research Preview — Human-AI Interaction
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-6xl font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-7xl"
          >
            Understand your{' '}
            <span className="gradient-text">emotions.</span>
            <br />
            Privately.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-gray-500"
          >
            ReflectAI combines private journaling with on-device AI emotion analysis.
            Your words are encrypted before storage. Your insights are generated from
            anonymised data only.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="gradient-bg inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/25"
              >
                Start Journaling Free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm hover:border-gray-300"
              >
                Sign In
              </motion.button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-sm text-gray-400"
          >
            18+ only · Not therapy · Free to use
          </motion.p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex h-8 w-5 items-start justify-center rounded-full border-2 border-gray-300 p-1"
          >
            <div className="h-2 w-1 rounded-full bg-gray-400" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <motion.p
              {...fadeUp}
              viewport={{ once: true }}
              whileInView={fadeUp.animate}
              className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600"
            >
              How it works
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-bold text-gray-900"
            >
              Simple, private, powerful
            </motion.h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="mb-4 text-4xl font-black text-gray-100">{step.num}</div>
                <h3 className="mb-2 font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-bold text-gray-900"
            >
              Built for your wellbeing
            </motion.h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust signals ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-violet-50 p-10 text-center"
          >
            <h2 className="mb-8 text-3xl font-bold text-gray-900">
              Privacy is not a feature. It&apos;s the foundation.
            </h2>
            <div className="grid gap-4 text-left sm:grid-cols-2">
              {[
                'AES-128-CBC + HMAC-SHA256 encryption',
                'Per-user PBKDF2 key derivation',
                'Raw text never leaves your device',
                'GDPR-compliant export & deletion',
                'Zero third-party data sharing',
                'On-device ML emotion analysis',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-500" aria-hidden="true" />
                  <span className="text-sm text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-24">
        <div className="absolute inset-0 -z-10 gradient-bg opacity-5" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="mb-4 text-4xl font-bold text-gray-900">Start your reflection journey</h2>
          <p className="mb-8 text-lg text-gray-500">
            Free, private, and takes less than a minute to set up.
          </p>
          <Link href="/register">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="gradient-bg inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-semibold text-white shadow-lg shadow-brand-500/25"
            >
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8">
        <p className="mx-auto max-w-3xl text-center text-xs text-gray-400">
          <strong className="text-gray-500">Important:</strong> ReflectAI is an emotional
          awareness journaling tool. It is not therapy, not a medical device, and not a crisis
          service. If you are experiencing a mental health emergency, contact{' '}
          <a href="tel:116123" className="underline hover:text-gray-600">
            Samaritans: 116 123
          </a>{' '}
          or emergency services (999 / 112). Built as a research portfolio project for UCD
          Human-AI Interaction PhD application.
        </p>
      </footer>
    </main>
  );
}
