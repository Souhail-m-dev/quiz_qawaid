import React from 'react';

const LETTRES = ['A', 'B', 'C', 'D'];

export default function OptionButton({
  index,
  texte,
  selectionne,
  valide,
  estCorrecte,
  estChoisie,
  onClick
}) {
  let classes =
    'w-full text-left rounded-lg border px-4 py-3 sm:py-4 transition-all duration-300 flex items-start gap-4 group ';

  if (!valide) {
    classes += selectionne
      ? 'border-accent bg-accent/10 shadow-gold'
      : 'border-white/10 bg-surface/50 hover:border-accent/40 hover:bg-surface/80';
  } else if (estCorrecte) {
    classes += 'border-correct bg-correct/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
  } else if (estChoisie) {
    classes += 'border-incorrect bg-incorrect/10';
  } else {
    classes += 'border-white/5 bg-surface/30 opacity-50';
  }

  let icone = null;
  if (valide && estCorrecte) icone = <span className="text-correct" aria-hidden>✓</span>;
  else if (valide && estChoisie) icone = <span className="text-incorrect" aria-hidden>✗</span>;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={valide}
      aria-label={`Réponse ${LETTRES[index]} : ${texte}`}
      role="radio"
      aria-checked={selectionne}
      className={classes}
    >
      <span
        className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-sm text-xs font-bold transition-colors duration-300 ${
          valide && estCorrecte
            ? 'bg-correct text-bg'
            : valide && estChoisie
            ? 'bg-incorrect text-white'
            : selectionne
            ? 'bg-accent text-bg'
            : 'bg-white/10 text-accent group-hover:bg-accent group-hover:text-bg'
        }`}
      >
        {LETTRES[index]}
      </span>
      <span className="flex-1 text-sm sm:text-base text-white/90 group-hover:text-white leading-relaxed font-medium">{texte}</span>
      {icone && <span className="text-lg animate-in zoom-in duration-300">{icone}</span>}
    </button>
  );
}
