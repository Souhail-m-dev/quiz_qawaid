import React from 'react';
import ProgressBar from './ProgressBar.jsx';
import ScoreIndicator from './ScoreIndicator.jsx';
import QuestionCard from './QuestionCard.jsx';

export default function QuizSession({
  questions,
  index,
  reponses,
  reponseEnCours,
  feedbackVisible,
  onChoisir,
  onValider,
  onSuivant,
  onQuitter
}) {
  const total = questions.length;
  const question = questions[index];
  const bonnes = reponses.filter((r) => r?.estCorrecte).length;
  const derniere = index === total - 1;

  if (!question) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <button
          type="button"
          onClick={onQuitter}
          className="text-sm text-primary/70 hover:text-primary inline-flex items-center gap-1"
        >
          <span aria-hidden>✕</span> Quitter
        </button>
        <ScoreIndicator bonnes={bonnes} />
      </div>

      <div className="mb-5">
        <ProgressBar courant={index + 1} total={total} />
      </div>

      <QuestionCard
        question={question}
        numero={index + 1}
        total={total}
        reponseEnCours={reponseEnCours}
        feedbackVisible={feedbackVisible}
        derniere={derniere}
        onChoisir={onChoisir}
        onValider={onValider}
        onSuivant={onSuivant}
      />
    </div>
  );
}
