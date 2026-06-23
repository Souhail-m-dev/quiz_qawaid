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
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8 gap-4">
        <button
          type="button"
          onClick={onQuitter}
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/60 hover:text-accent inline-flex items-center gap-2 group transition-colors"
        >
          <span className="text-sm transition-transform group-hover:rotate-90" aria-hidden>✕</span> Abandonner
        </button>
        <ScoreIndicator bonnes={bonnes} />
      </div>

      <div className="mb-8">
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

      <div className="mt-8 text-center opacity-30">
        <div className="w-1 h-1 bg-accent rounded-full inline-block mx-1" />
        <div className="w-1 h-1 bg-accent rounded-full inline-block mx-1" />
        <div className="w-1 h-1 bg-accent rounded-full inline-block mx-1" />
      </div>
    </div>
  );
}
