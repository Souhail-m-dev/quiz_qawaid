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
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <div className="text-center mb-6">
        <div className="font-display text-4xl sm:text-5xl text-primary">
          {score} <span className="text-muted text-2xl">/ {total}</span>
        </div>
        <div className={`mt-3 inline-block border rounded-full px-4 py-1.5 text-sm font-semibold ${TON_CLS[mention.ton]}`}>
          {mention.libelle}
        </div>
        <p className="text-sm text-muted mt-2">{mention.sousTitre}</p>
      </div>

      <div className="card mb-5">
        <h3 className="font-display text-lg text-primary mb-3">Score par difficulté</h3>
        <ul className="space-y-2">
          {['facile', 'moyenne', 'difficile'].map((lvl) => {
            const b = buckets[lvl];
            if (b.total === 0) return null;
            return (
              <li key={lvl} className="flex items-center justify-between text-sm">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGE_DIFF[lvl]}`}>
                  {lvl[0].toUpperCase() + lvl.slice(1)}s
                </span>
                <span className="font-semibold text-ink">{b.ok} / {b.total}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {ratees.length > 0 && (
        <div className="card mb-5">
          <button
            type="button"
            onClick={() => setOuverte((v) => !v)}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={ouverte}
          >
            <h3 className="font-display text-lg text-primary">
              Questions ratées ({ratees.length})
            </h3>
            <span className="text-primary text-xl" aria-hidden>{ouverte ? '−' : '+'}</span>
          </button>

          {ouverte && (
            <ul className="mt-4 space-y-4">
              {ratees.map(({ q, r }) => (
                <li key={q.id} className="border-l-2 border-incorrect/40 pl-3">
                  <p className="font-semibold text-ink text-sm">{q.question}</p>
                  {r?.reponseChoisie != null && (
                    <p className="mt-1 text-xs text-incorrect">
                      Votre réponse : {LETTRES[r.reponseChoisie]}. {q.options[r.reponseChoisie]}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-correct">
                    Bonne réponse : {LETTRES[q.reponseCorrecte]}. {q.options[q.reponseCorrecte]}
                  </p>
                  {q.justification && (
                    <p className="mt-1 text-xs text-muted leading-relaxed">{q.justification}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onRejouer} className="btn-primary">
          Rejouer
        </button>
        <button type="button" onClick={onAccueil} className="btn-secondary">
          Retour accueil
        </button>
      </div>
    </div>
  );
}
