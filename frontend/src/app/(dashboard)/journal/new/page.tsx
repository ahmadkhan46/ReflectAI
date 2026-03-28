import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { JournalEntryForm } from '@/components/journal/journal-entry-form';

export const metadata: Metadata = { title: 'New Entry' };

export default function NewJournalEntryPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">New Journal Entry</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-400">
            <Lock className="h-3.5 w-3.5" />
            Encrypted with your personal key — only you can read this
          </p>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-8 shadow">
          <JournalEntryForm />
        </div>
      </main>
    </>
  );
}
