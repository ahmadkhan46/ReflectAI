import { EMOTION_COLORS, EMOTION_LABELS } from '@/types/journal';
import type { EmotionAnalysis } from '@/types/journal';

interface EmotionBadgeProps {
  emotion: EmotionAnalysis;
  showConfidence?: boolean;
}

export function EmotionBadge({ emotion, showConfidence = false }: EmotionBadgeProps) {
  const display = emotion.is_user_corrected
    ? emotion.user_corrected_emotion ?? emotion.primary_emotion
    : emotion.primary_emotion;

  const color = EMOTION_COLORS[display] ?? EMOTION_COLORS.neutral;
  const label = EMOTION_LABELS[display] ?? display;

  if (emotion.analysis_status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Analysing…
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}33`, color: darken(color) }}
      aria-label={`Detected emotion: ${label}`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
      {showConfidence && emotion.primary_confidence > 0 && (
        <span className="opacity-70">
          ({(emotion.primary_confidence * 100).toFixed(0)}%)
        </span>
      )}
      {emotion.is_user_corrected && (
        <span title="User corrected" className="opacity-60">✏️</span>
      )}
    </span>
  );
}

/** Rough darkening for text on light background. */
function darken(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * 0.5)},${Math.floor(g * 0.5)},${Math.floor(b * 0.5)})`;
  } catch {
    return '#374151';
  }
}
