import React from 'react';

export default function SelectionCours({ cours, onSelect, onRetour }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <button type="button" onClick={onRetour} className="text-sm text-primary/80 hover:text-primary mb-4 inline-flex items-center gap-1">
        <span aria-hidden>←</span> Retour
      </button>

      <h2 className="font-display text-2xl sm:text-3xl text-primary mb-1">Choisissez un cours</h2>
      <p className="text-sm text-muted mb-6">{cours.length} cours disponibles. Les cours sans questions seront ajoutés progressivement.</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {cours.map((c) => {
          const dispo = c.questions.length > 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!dispo}
                onClick={() => dispo && onSelect(c.id)}
                className={`w-full text-left card transition ${
                  dispo ? 'hover:shadow-card active:scale-[0.99]' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-accent font-semibold uppercase tracking-wide">
                      Cours {c.id}
                    </div>
                    <div className="font-display text-lg text-primary mt-1 leading-snug">
                      {c.titre}
                    </div>
                    {c.date && (
                      <div className="text-xs text-muted mt-1">{c.date}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted shrink-0">
                    {dispo ? `${c.questions.length} q.` : 'à venir'}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
