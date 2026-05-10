import React from 'react';

export default function FeedbackPanel({ estCorrecte, justification, derniere, onSuivant }) {
  return (
    <div
      className={`mt-6 rounded-lg border p-5 sm:p-6 animate-in slide-in-from-top-4 duration-500 ${
        estCorrecte ? 'border-correct/30 bg-correct/5 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'border-incorrect/30 bg-incorrect/5 shadow-[0_0_20px_rgba(239,68,68,0.05)]'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className={`font-display uppercase tracking-[0.2em] text-sm mb-3 ${estCorrecte ? 'text-correct' : 'text-incorrect'}`}>
        {estCorrecte ? '✓ Excellence' : '✗ À réviser'}
      </div>
      {justification && (
        <div className="relative pl-4 border-l border-white/10">
          <p className="text-sm sm:text-base text-white/80 leading-relaxed italic">
            {justification}
          </p>
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onSuivant} className="btn-primary w-full group">
          <span>{derniere ? 'Consulter le bilan' : 'Poursuivre la révision'}</span>
          <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
