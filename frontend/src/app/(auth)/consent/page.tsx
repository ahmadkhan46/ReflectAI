'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Eye, Trash2, Download, AlertTriangle, BookOpen } from 'lucide-react';
import { staggerContainer, staggerItem } from '@/lib/motion';

const sections = [
  {
    icon: Eye,
    color: 'bg-brand-50 text-brand-600',
    title: 'What We Collect',
    body: 'Your email address, encrypted journal entries, and anonymised emotion metadata (emotion labels, confidence scores, timestamps). Raw journal text is NEVER sent to external AI services — only aggregated, anonymised emotion patterns are.',
  },
  {
    icon: Shield,
    color: 'bg-violet-50 text-violet-600',
    title: 'How We Protect It',
    body: 'Journal entries are encrypted with AES-128-CBC + HMAC-SHA256 (Fernet) using a per-user key derived via PBKDF2-SHA256 with 480,000 iterations. The encryption key is never stored — only your unique salt is. Even platform administrators cannot read your entries.',
  },
  {
    icon: Download,
    color: 'bg-green-50 text-green-600',
    title: 'Your Rights (GDPR)',
    body: 'You have the right to access, export (JSON), and permanently delete all your data at any time from your account settings page. Data export is immediate; deletion is complete within 30 days.',
  },
  {
    icon: Trash2,
    color: 'bg-pink-50 text-pink-600',
    title: 'Data Retention',
    body: 'Your data is retained for as long as your account is active. Upon account deletion, all data including encrypted journal entries, emotion metadata, and personal information is permanently and irreversibly removed.',
  },
];

export default function ConsentPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-12">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-violet-300/10 blur-3xl" />
        <div className="absolute left-1/4 bottom-1/4 h-72 w-72 rounded-full bg-brand-300/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex justify-center"
        >
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl gradient-bg shadow-lg shadow-brand-500/25">
            <BookOpen className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
        </motion.div>

        {/* Crisis warning */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-amber-800">Not a Medical or Crisis Service</h2>
              <p className="mt-1 text-sm text-amber-700">
                ReflectAI is an emotional journaling tool only. It does not provide therapy, diagnosis,
                or crisis support. If you are in immediate danger, call{' '}
                <a href="tel:999" className="font-semibold underline">999 / 112</a> or{' '}
                <a href="tel:116123" className="font-semibold underline">Samaritans: 116 123</a>.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8 text-center"
        >
          <h1 className="text-3xl font-bold text-gray-900">Privacy &amp; Consent</h1>
          <p className="mt-2 text-gray-500">
            You must be 18 or older to use ReflectAI. Please read this before creating your account.
          </p>
        </motion.div>

        {/* Sections */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {sections.map((s) => (
            <motion.div
              key={s.title}
              variants={staggerItem}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                  <s.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            href="/register"
            className="gradient-bg flex-1 rounded-xl px-6 py-3 text-center text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:opacity-90 transition-opacity"
          >
            I understand — Create Account
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Go Back
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
