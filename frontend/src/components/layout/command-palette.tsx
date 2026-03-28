'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  PenLine,
  Sparkles,
  CalendarDays,
  Settings,
  BookOpen,
  Zap,
  LogOut,
  Search,
  Clock,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { logout } from '@/lib/api/auth';
import { generateInsightNow } from '@/lib/api/journal';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  action: () => void;
  keywords?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  const handleGenerateInsight = useCallback(async () => {
    onClose();
    setGenerating(true);
    try {
      await generateInsightNow('weekly');
      toast.success('Weekly insight generated!');
    } catch {
      toast.error('Could not generate insight.');
    } finally {
      setGenerating(false);
    }
  }, [onClose]);

  const handleLogout = useCallback(async () => {
    onClose();
    try {
      await logout();
      toast.success('Signed out');
      router.push('/login');
    } catch {
      router.push('/login');
    }
  }, [onClose, router]);

  const items: CommandItem[] = [
    // Navigation
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      group: 'Navigate',
      action: () => navigate('/dashboard'),
      keywords: 'home overview',
    },
    {
      id: 'new-entry',
      label: 'Write new journal entry',
      icon: <PenLine className="h-4 w-4" />,
      group: 'Navigate',
      action: () => navigate('/journal/new'),
      keywords: 'write create journal entry',
    },
    {
      id: 'insights',
      label: 'View Insights',
      icon: <Sparkles className="h-4 w-4" />,
      group: 'Navigate',
      action: () => navigate('/insights'),
      keywords: 'ai weekly monthly',
    },
    {
      id: 'insights-history',
      label: 'All Insights History',
      icon: <BookOpen className="h-4 w-4" />,
      group: 'Navigate',
      action: () => navigate('/insights/history'),
      keywords: 'archive past previous',
    },
    {
      id: 'calendar',
      label: 'Mood Calendar',
      icon: <CalendarDays className="h-4 w-4" />,
      group: 'Navigate',
      action: () => navigate('/calendar'),
      keywords: 'mood heatmap month',
    },
    {
      id: 'settings',
      label: 'Privacy & Settings',
      icon: <Settings className="h-4 w-4" />,
      group: 'Navigate',
      action: () => navigate('/settings'),
      keywords: 'account export data delete',
    },
    // Actions
    {
      id: 'gen-daily',
      label: 'Generate Daily Insight',
      icon: <Clock className="h-4 w-4" />,
      group: 'Actions',
      action: async () => {
        onClose();
        try {
          await generateInsightNow('daily');
          toast.success('Daily insight generated!');
        } catch {
          toast.error('Could not generate insight.');
        }
      },
      keywords: 'ai generate create today',
    },
    {
      id: 'gen-weekly',
      label: 'Generate Weekly Insight',
      icon: <Zap className="h-4 w-4" />,
      group: 'Actions',
      action: handleGenerateInsight,
      keywords: 'ai generate weekly create',
    },
    {
      id: 'gen-monthly',
      label: 'Generate Monthly Insight',
      icon: <Calendar className="h-4 w-4" />,
      group: 'Actions',
      action: async () => {
        onClose();
        try {
          await generateInsightNow('monthly');
          toast.success('Monthly insight generated!');
        } catch {
          toast.error('Could not generate insight.');
        }
      },
      keywords: 'ai generate monthly create',
    },
    {
      id: 'gen-yearly',
      label: 'Generate Yearly Insight',
      icon: <TrendingUp className="h-4 w-4" />,
      group: 'Actions',
      action: async () => {
        onClose();
        try {
          await generateInsightNow('yearly');
          toast.success('Yearly insight generated!');
        } catch {
          toast.error('Could not generate insight.');
        }
      },
      keywords: 'ai generate yearly create',
    },
    // Account
    {
      id: 'logout',
      label: 'Sign out',
      icon: <LogOut className="h-4 w-4" />,
      group: 'Account',
      action: handleLogout,
      keywords: 'logout signout exit',
    },
  ];

  // Group items
  const groups = Array.from(new Set(items.map((i) => i.group)));

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2"
          >
            <Command
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/20"
              loop
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                <Command.Input
                  placeholder="Search pages, actions…"
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  autoFocus
                />
                <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 sm:block">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[360px] overflow-y-auto py-2">
                <Command.Empty className="py-8 text-center text-sm text-gray-400">
                  No results found.
                </Command.Empty>

                {groups.map((group) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400"
                  >
                    {items
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.keywords ?? ''}`}
                          onSelect={item.action}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors aria-selected:bg-brand-50 aria-selected:text-brand-700 [&_svg]:text-gray-400 aria-selected:[&_svg]:text-brand-500"
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Footer hint */}
              <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-4">
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">ESC</kbd>
                  close
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
