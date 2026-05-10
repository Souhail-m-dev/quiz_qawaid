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
    <div className="flex flex-col bg-bg min-h-screen sm:min-h-0 sm:h-auto overflow-x-hidden animate-in fade-in duration-700 sm:relative fixed inset-0 h-[100svh] h-[100dvh]">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-4 sm:py-10 overflow-hidden sm:overflow-visible">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-8 gap-4 shrink-0">
          <button
            type="button"
            onClick={onQuitter}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/60 hover:text-accent inline-flex items-center gap-2 group transition-colors"
          >
            <span className="text-sm transition-transform group-hover:rotate-90" aria-hidden>✕</span> Abandonner
          </button>
          <ScoreIndicator bonnes={bonnes} />
        </div>

        {/* Progress Bar */}
        <div className="mb-4 shrink-0">
          <ProgressBar courant={index + 1} total={total} />
        </div>

        {/* Question Area - Takes remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
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
      </div>
      
      {/* Visual Footer - Subtle */}
      <div className="py-2 text-center opacity-20 shrink-0">
        <div className="w-1 h-1 bg-accent rounded-full inline-block mx-1" />
        <div className="w-1 h-1 bg-accent rounded-full inline-block mx-1" />
        <div className="w-1 h-1 bg-accent rounded-full inline-block mx-1" />
      </div>
    </div>
  );
}
