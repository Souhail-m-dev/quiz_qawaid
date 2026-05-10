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
    <div className="card relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">
          Question {numero} <span className="text-muted mx-1">/</span> {total}
        </span>
        <span className={`text-[9px] font-bold px-3 py-1 rounded-sm border border-current uppercase tracking-widest ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <h2 className="title-display text-lg sm:text-xl normal-case tracking-normal mb-8 leading-relaxed text-white">
        {question.question}
      </h2>

      <div className="grid gap-3 sm:gap-4" role="radiogroup" aria-label="Choisissez une réponse">
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
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={reponseEnCours === null}
            onClick={onValider}
            className="btn-primary w-full sm:w-auto min-w-[160px]"
          >
            Valider la réponse
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
