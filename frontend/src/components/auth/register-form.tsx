'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { register as registerUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { staggerContainer, staggerItem } from '@/lib/motion';

const schema = z.object({
  full_name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/\d/, 'Include a digit'),
  age_verified: z.literal<boolean>(true, {
    errorMap: () => ({ message: 'You must confirm you are 18 or older.' }),
  }),
  consent_given: z.literal<boolean>(true, {
    errorMap: () => ({ message: 'You must accept the data processing terms.' }),
  }),
});

type FormValues = z.infer<typeof schema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase', pass: /[a-z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
  ];
  const strength = checks.filter((c) => c.pass).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="overflow-hidden"
    >
      <div className="mt-2 space-y-2">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < strength ? colors[strength - 1] : 'bg-gray-200'
              }`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.05 }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`flex items-center gap-1 text-xs transition-colors ${
                c.pass ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {c.pass ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const password = watch('password', '');

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await registerUser(data);
      setSuccess(true);
      toast.success('Account created! Check your email.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong.';
      setServerError(msg);
      toast.error(msg);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
        </motion.div>
        <h3 className="mb-2 font-semibold text-green-800">Account created!</h3>
        <p className="mb-4 text-sm text-green-700">
          Check your email to verify your address before signing in.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-green-700 underline underline-offset-2 hover:text-green-900"
        >
          Go to sign in →
        </Link>
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
      <AnimatePresence>
        {serverError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={staggerItem} className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" type="text" autoComplete="name" placeholder="Alex Smith" {...register('full_name')} />
        {errors.full_name && <p className="text-xs text-red-500" role="alert">{errors.full_name.message}</p>}
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        {errors.email && <p className="text-xs text-red-500" role="alert">{errors.email.message}</p>}
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordStrength password={password} />
        {errors.password && <p className="text-xs text-red-500" role="alert">{errors.password.message}</p>}
      </motion.div>

      {/* Compliance */}
      <motion.div variants={staggerItem} className="space-y-3 rounded-xl bg-gray-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600"
            {...register('age_verified')}
          />
          <span className="text-sm text-gray-700">
            I confirm I am <strong>18 years of age or older</strong>.
          </span>
        </label>
        {errors.age_verified && <p className="text-xs text-red-500" role="alert">{errors.age_verified.message}</p>}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600"
            {...register('consent_given')}
          />
          <span className="text-sm text-gray-700">
            I accept the{' '}
            <Link href="/consent" className="text-brand-600 underline underline-offset-2" target="_blank">
              privacy & consent terms
            </Link>{' '}
            and understand ReflectAI is <strong>not therapy</strong>.
          </span>
        </label>
        {errors.consent_given && <p className="text-xs text-red-500" role="alert">{errors.consent_given.message}</p>}
      </motion.div>

      <motion.div variants={staggerItem}>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isSubmitting}
          className="gradient-bg flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.form>
  );
}
