import React from 'react';

export default function ScoreIndicator({ bonnes }) {
  return (
    <div
      className="inline-flex items-center gap-2 text-xs font-bold text-accent border border-accent/20 bg-accent/5 px-3 py-1 rounded-sm uppercase tracking-widest"
      aria-live="polite"
    >
      <span className="text-sm" aria-hidden>٭</span>
      <span>{bonnes} Réussite{bonnes > 1 ? 's' : ''}</span>
    </div>
  );
}
