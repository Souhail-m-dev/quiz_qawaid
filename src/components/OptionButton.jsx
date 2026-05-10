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
    'w-full text-left rounded-xl border px-4 py-3 sm:py-3.5 transition flex items-start gap-3 ';

  if (!valide) {
    classes += selectionne
      ? 'border-primary bg-primary/5 shadow-soft'
      : 'border-primary/15 bg-white hover:border-primary/40';
  } else if (estCorrecte) {
    classes += 'border-correct bg-correct/10';
  } else if (estChoisie) {
    classes += 'border-incorrect bg-incorrect/10';
  } else {
    classes += 'border-primary/10 bg-white opacity-70';
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
        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
          valide && estCorrecte
            ? 'bg-correct text-white'
            : valide && estChoisie
            ? 'bg-incorrect text-white'
            : selectionne
            ? 'bg-primary text-white'
            : 'bg-primary/10 text-primary'
        }`}
      >
        {LETTRES[index]}
      </span>
      <span className="flex-1 text-sm sm:text-base text-ink leading-relaxed">{texte}</span>
      {icone && <span className="text-lg">{icone}</span>}
    </button>
  );
}
