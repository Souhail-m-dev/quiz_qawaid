import React from 'react';

export default function FeedbackPanel({ estCorrecte, justification, derniere, onSuivant }) {
  return (
    <div
      className={`mt-5 rounded-xl border p-4 sm:p-5 ${
        estCorrecte ? 'border-correct/30 bg-correct/5' : 'border-incorrect/30 bg-incorrect/5'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className={`font-semibold ${estCorrecte ? 'text-correct' : 'text-incorrect'}`}>
        {estCorrecte ? '✓ Bonne réponse !' : '✗ Mauvaise réponse'}
      </div>
      {justification && (
        <p className="mt-2 text-sm sm:text-base text-ink/90 leading-relaxed">
          {justification}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onSuivant} className="btn-primary">
          {derniere ? 'Voir les résultats' : 'Question suivante'}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
