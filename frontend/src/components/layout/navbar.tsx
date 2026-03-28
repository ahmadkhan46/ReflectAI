'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, LogOut, Settings, PlusCircle, Sparkles, ShieldCheck, CalendarDays, Search, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { logout, getMe } from '@/lib/api/auth';
import { CommandPalette } from './command-palette';

const BASE_NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/journal/new', label: 'New Entry', icon: PlusCircle },
  { href: '/insights', label: 'Insights', icon: Sparkles },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: Activity },
];

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    getMe().then((u) => setIsAdmin(u.is_admin)).catch(() => {});
  }, []);

  // Global Ctrl+K / Cmd+K shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCmdOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const NAV_LINKS = isAdmin
    ? [...BASE_NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 px-6 py-3 backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-gray-900">
            <div className="gradient-bg flex h-8 w-8 items-center justify-center rounded-lg">
              <BookOpen className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="gradient-text">ReflectAI</span>
          </Link>

          {/* Nav links */}
          <div className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'text-brand-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg bg-brand-50"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {link.icon && <link.icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Search / command palette trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-100 sm:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search…</span>
              <kbd className="ml-1 rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-medium text-gray-400">
                ⌘K
              </kbd>
            </button>

            <Link
              href="/settings"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.nav>
    </>
  );
}
