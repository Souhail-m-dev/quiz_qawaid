import React from 'react';

export default function SelectionCours({ cours, onSelect, onRetour }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-14">
      <button type="button" onClick={onRetour} className="text-xs uppercase tracking-[0.2em] text-accent/80 hover:text-accent mb-8 inline-flex items-center gap-2 group">
        <span className="transition-transform group-hover:-translate-x-1" aria-hidden>←</span> Retour au menu
      </button>

      <h2 className="title-display text-2xl sm:text-3xl mb-2">Syllabus des cours</h2>
      <p className="text-xs text-muted uppercase tracking-[0.1em] mb-10">{cours.length} Unités d'étude répertoriées</p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {cours.map((c) => {
          const dispo = c.questions.length > 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!dispo}
                onClick={() => dispo && onSelect(c.id)}
                className={`w-full text-left card transition-all duration-300 border-accent/10 ${
                  dispo ? 'hover:border-accent/50 hover:bg-surface active:scale-[0.99] group' : 'opacity-40 cursor-not-allowed grayscale'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-accent font-bold uppercase tracking-[0.2em] mb-2">
                      Unité {c.id}
                    </div>
                    <div className="font-display text-white group-hover:text-accent transition uppercase text-sm sm:text-base leading-tight tracking-wider">
                      {c.titre}
                    </div>
                    {c.date && (
                      <div className="text-[10px] text-muted mt-2 tracking-widest">{c.date}</div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-tighter shrink-0 pt-1 font-bold">
                    {dispo ? `${c.questions.length} questions` : 'En préparation'}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
