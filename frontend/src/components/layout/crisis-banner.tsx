import { Phone } from 'lucide-react';

export function CrisisBanner() {
  return (
    <div
      className="w-full border-b border-amber-100 bg-amber-50 px-4 py-2"
      role="banner"
      aria-label="Crisis resources"
    >
      <p className="text-center text-xs text-amber-700">
        <Phone className="mr-1 inline h-3 w-3" aria-hidden="true" />
        <strong>Not therapy.</strong> In crisis?{' '}
        <a
          href="tel:116123"
          className="font-semibold underline underline-offset-2 hover:text-amber-900"
          aria-label="Call Samaritans on 116 123"
        >
          Samaritans: 116 123
        </a>{' '}
        &middot;{' '}
        <a
          href="tel:999"
          className="font-semibold underline underline-offset-2 hover:text-amber-900"
          aria-label="Call emergency services on 999 or 112"
        >
          Emergency: 999 / 112
        </a>
      </p>
    </div>
  );
}
