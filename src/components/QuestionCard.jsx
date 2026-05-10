import React from 'react';
import OptionButton from './OptionButton.jsx';
import FeedbackPanel from './FeedbackPanel.jsx';

const BADGE = {
  facile: { label: 'Facile', cls: 'bg-facile/10 text-facile' },
  moyenne: { label: 'Moyenne', cls: 'bg-moyenne/10 text-moyenne' },
  difficile: { label: 'Difficile', cls: 'bg-difficile/10 text-difficile' }
};

export default function QuestionCard({
  question,
  numero,
  total,
  reponseEnCours,
  feedbackVisible,
  onChoisir,
  onValider,
  onSuivant,
  derniere
}) {
  const badge = BADGE[question.difficulte] ?? BADGE.moyenne;
  const estCorrecteSelection =
    feedbackVisible && reponseEnCours === question.reponseCorrecte;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">
          Question {numero} / {total}
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <h2 className="font-display text-lg sm:text-xl text-primary leading-snug mb-5">
        {question.question}
      </h2>

      <div className="grid gap-2.5 sm:gap-3" role="radiogroup" aria-label="Choisissez une réponse">
        {question.options.map((opt, i) => (
          <OptionButton
            key={i}
            index={i}
            texte={opt}
            selectionne={reponseEnCours === i}
            valide={feedbackVisible}
            estCorrecte={i === question.reponseCorrecte}
            estChoisie={reponseEnCours === i}
            onClick={() => onChoisir(i)}
          />
        ))}
      </div>

      {!feedbackVisible && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={reponseEnCours === null}
            onClick={onValider}
            className="btn-primary"
          >
            Valider
          </button>
        </div>
      )}

      {feedbackVisible && (
        <FeedbackPanel
          estCorrecte={estCorrecteSelection}
          justification={question.justification}
          derniere={derniere}
          onSuivant={onSuivant}
        />
      )}
    </div>
  );
}
