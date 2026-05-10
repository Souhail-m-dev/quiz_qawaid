import React from 'react';

export default function ProgressBar({ courant, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((courant / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>Question {courant} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-300"
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
