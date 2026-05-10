import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OptionButton from './OptionButton.jsx';
import FeedbackPanel from './FeedbackPanel.jsx';

const BADGE = {
  facile: { label: 'Facile', cls: 'text-facile' },
  moyenne: { label: 'Moyenne', cls: 'text-moyenne' },
  difficile: { label: 'Difficile', cls: 'text-difficile' }
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
    <motion.div 
      key={question.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="card relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">
          Unité {question.coursId} <span className="text-muted mx-1">•</span> Q{numero}
        </span>
        <span className={`text-[9px] font-bold px-3 py-1 rounded-sm border border-current uppercase tracking-widest ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <div className="mb-8">
        <h2 className="title-display text-lg sm:text-xl normal-case tracking-normal leading-relaxed text-white">
          {question.question}
        </h2>
      </div>

      <div className="grid gap-3 sm:gap-4" role="radiogroup" aria-label="Choisissez une réponse">
        <AnimatePresence mode="popLayout">
          {question.options.map((opt, i) => {
            const isCorrect = i === question.reponseCorrecte;
            const isSelected = reponseEnCours === i;
            
            if (feedbackVisible && !isCorrect && !isSelected) return null;

            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
              >
                <OptionButton
                  index={i}
                  texte={opt}
                  selectionne={reponseEnCours === i}
                  valide={feedbackVisible}
                  estCorrecte={isCorrect}
                  estChoisie={isSelected}
                  onClick={() => onChoisir(i)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
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
    </motion.div>
  );
}
