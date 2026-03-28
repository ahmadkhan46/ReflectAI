'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Trash2, Shield, Eye, Lock, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/layout/navbar';
import { exportData, deleteAccount } from '@/lib/api/journal';
import { staggerContainer, staggerItem } from '@/lib/motion';

function PrivacyItem({
  icon: Icon,
  color,
  title,
  description,
  positive = true,
}: {
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  positive?: boolean;
}) {
  return (
    <motion.li variants={staggerItem} className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${positive ? 'bg-green-100' : 'bg-red-50'}`}>
        {positive ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        )}
      </div>
      <div>
        <span className="text-sm font-medium text-gray-800">{title}: </span>
        <span className="text-sm text-gray-500">{description}</span>
      </div>
    </motion.li>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm1' | 'confirm2'>('idle');
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportData();
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput.toLowerCase() !== 'delete') {
      toast.error('Type "delete" to confirm');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success('Account deleted');
      router.push('/');
    } catch {
      toast.error('Deletion failed. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">Privacy &amp; Settings</h1>
          <p className="mt-1 text-gray-500">Manage your data and account</p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-6"
        >
          {/* Export card */}
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border border-gray-300 bg-white p-6 shadow"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <Download className="h-5 w-5 text-brand-600" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Export Your Data</h2>
                <p className="text-xs text-gray-400">GDPR Article 20 — Right to data portability</p>
              </div>
            </div>
            <p className="mb-5 text-sm text-gray-500">
              Download all your journal entries, emotion data, and insights as a JSON file.
              Your entries are decrypted in the export for readability.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 transition-colors"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {exporting ? 'Preparing export…' : 'Download My Data (JSON)'}
            </motion.button>
          </motion.div>

          {/* Privacy summary card */}
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border border-gray-300 bg-white p-6 shadow"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
                <Shield className="h-5 w-5 text-violet-600" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">What We Store</h2>
                <p className="text-xs text-gray-400">Transparent data practices</p>
              </div>
            </div>
            <motion.ul
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-3"
            >
              <PrivacyItem
                icon={Lock}
                color="brand"
                title="Journal entries"
                description="Encrypted with AES-128-CBC + HMAC-SHA256. Platform staff cannot read them."
              />
              <PrivacyItem
                icon={Eye}
                color="violet"
                title="Emotion scores"
                description="Labels and confidence scores stored unencrypted for pattern analysis."
              />
              <PrivacyItem
                icon={Shield}
                color="green"
                title="AI insights"
                description="Generated from anonymised statistics. Raw text is never sent to external AI."
              />
              <PrivacyItem
                icon={XCircle}
                color="red"
                title="Third-party sharing"
                description="None. No advertising, no data sales."
                positive={false}
              />
            </motion.ul>
          </motion.div>

          {/* Danger zone */}
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <Trash2 className="h-5 w-5 text-red-500" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-red-700">Delete Account</h2>
                <p className="text-xs text-red-400">GDPR Article 17 — Right to erasure</p>
              </div>
            </div>
            <p className="mb-5 text-sm text-gray-500">
              Permanently delete your account and ALL associated data — entries, emotions, insights.
              This action is <strong className="text-gray-700">irreversible</strong>.
            </p>

            <AnimatePresence mode="wait">
              {deletePhase === 'idle' && (
                <motion.button
                  key="start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeletePhase('confirm1')}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete My Account
                </motion.button>
              )}

              {deletePhase === 'confirm1' && (
                <motion.div
                  key="confirm1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-red-200 bg-red-50 p-4"
                >
                  <p className="mb-3 text-sm font-medium text-red-700">
                    Are you absolutely sure? This will permanently erase all your data.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeletePhase('confirm2')}
                      className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                    >
                      Yes, continue
                    </button>
                    <button
                      onClick={() => setDeletePhase('idle')}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {deletePhase === 'confirm2' && (
                <motion.div
                  key="confirm2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
                >
                  <p className="text-sm font-medium text-red-700">
                    Type <code className="rounded bg-red-100 px-1 py-0.5 font-mono">delete</code> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="delete"
                    className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteInput.toLowerCase() !== 'delete'}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {deleting ? 'Deleting…' : 'Permanently Delete'}
                    </button>
                    <button
                      onClick={() => { setDeletePhase('idle'); setDeleteInput(''); }}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </main>
    </>
  );
}
