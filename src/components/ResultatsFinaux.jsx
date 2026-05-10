import React, { useMemo, useState } from 'react';
import { computeMention, scoreParDifficulte } from '../utils/quizUtils.js';

const LETTRES = ['A', 'B', 'C', 'D'];

const TON_CLS = {
  success: 'bg-correct/10 text-correct border-correct/30',
  info: 'bg-primary/5 text-primary border-primary/30',
  warn: 'bg-moyenne/10 text-moyenne border-moyenne/30',
  danger: 'bg-incorrect/10 text-incorrect border-incorrect/30'
};

const BADGE_DIFF = {
  facile: 'bg-facile/10 text-facile',
  moyenne: 'bg-moyenne/10 text-moyenne',
  difficile: 'bg-difficile/10 text-difficile'
};

export default function ResultatsFinaux({ questions, reponses, onRejouer, onAccueil }) {
  const total = questions.length;
  const score = reponses.filter((r) => r?.estCorrecte).length;
  const mention = computeMention(score, total);
  const buckets = useMemo(() => scoreParDifficulte(reponses, questions), [reponses, questions]);

  const ratees = questions
    .map((q, i) => ({ q, r: reponses[i], i }))
    .filter((x) => !x.r?.estCorrecte);

  const [ouverte, setOuverte] = useState(true);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-14">
      <div className="text-center mb-10">
        <div className="title-display text-5xl sm:text-6xl text-white mb-2">
          {score} <span className="text-accent text-2xl">/ {total}</span>
        </div>
        <div className={`mt-4 inline-block border-2 rounded-sm px-6 py-2 text-xs font-bold uppercase tracking-[0.2em] ${TON_CLS[mention.ton]}`}>
          {mention.libelle}
        </div>
        <p className="text-sm text-muted mt-4 italic tracking-wide">{mention.sousTitre}</p>
      </div>

      <div className="card mb-6 border-accent/10">
        <h3 className="title-display text-sm mb-4 tracking-[0.2em]">Bilan par difficulté</h3>
        <ul className="space-y-3">
          {['facile', 'moyenne', 'difficile'].map((lvl) => {
            const b = buckets[lvl];
            if (b.total === 0) return null;
            return (
              <li key={lvl} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <span className={`px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest border border-current ${BADGE_DIFF[lvl]}`}>
                  {lvl}
                </span>
                <span className="font-bold text-white tracking-widest">{b.ok} <span className="text-muted mx-1">/</span> {b.total}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {ratees.length > 0 && (
        <div className="card mb-8 border-accent/10">
          <button
            type="button"
            onClick={() => setOuverte((v) => !v)}
            className="w-full flex items-center justify-between text-left group"
            aria-expanded={ouverte}
          >
            <h3 className="title-display text-sm tracking-[0.2em]">
              Points à consolider ({ratees.length})
            </h3>
            <span className="text-accent text-2xl transition-transform duration-300 group-hover:scale-110" aria-hidden>{ouverte ? '−' : '+'}</span>
          </button>

          {ouverte && (
            <ul className="mt-6 space-y-6">
              {ratees.map(({ q, r }) => (
                <li key={q.id} className="relative pl-5 border-l border-accent/20">
                  <div className="absolute top-0 left-0 w-[2px] h-4 bg-accent/40" />
                  <p className="font-medium text-white text-sm leading-relaxed">{q.question}</p>
                  <div className="mt-3 space-y-2">
                    {r?.reponseChoisie != null && (
                      <p className="text-[11px] text-incorrect uppercase tracking-wider font-bold">
                        Votre choix : <span className="opacity-80 italic font-normal normal-case">{q.options[r.reponseChoisie]}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-correct uppercase tracking-wider font-bold">
                      Réponse correcte : <span className="opacity-80 italic font-normal normal-case">{q.options[q.reponseCorrecte]}</span>
                    </p>
                  </div>
                  {q.justification && (
                    <div className="mt-3 p-3 bg-white/5 rounded text-[11px] text-muted leading-relaxed italic border-l-2 border-accent/10">
                      {q.justification}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={onRejouer} className="btn-primary">
          Nouvelle session
        </button>
        <button type="button" onClick={onAccueil} className="btn-secondary">
          Quitter le quiz
        </button>
      </div>
    </div>
  );
}
