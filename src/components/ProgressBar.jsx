import React from 'react';

export default function ProgressBar({ courant, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((courant / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>Question {courant} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-700 ease-out shadow-[0_0_10px_rgba(197,160,89,0.5)]"
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
    </div>
  );
}
