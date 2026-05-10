import React from 'react';

export default function ScoreIndicator({ bonnes }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-correct bg-correct/10 px-2.5 py-1 rounded-full"
      aria-live="polite"
    >
      <span aria-hidden>✓</span>
      <span>{bonnes} bonne{bonnes > 1 ? 's' : ''} réponse{bonnes > 1 ? 's' : ''}</span>
    </div>
  );
}
