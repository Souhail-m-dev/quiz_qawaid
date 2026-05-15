import React, { useMemo, useState } from 'react';
import data from '../data/questions.json';
import { getAllQuestions } from '../utils/quizUtils.js';

const difficulteColor = {
  facile: 'bg-facile/20 text-facile',
  moyenne: 'bg-moyenne/20 text-moyenne',
  difficile: 'bg-difficile/20 text-difficile'
};

export default function QuestionPicker({ value = [], onChange }) {
  const allQuestions = useMemo(() => getAllQuestions(data), []);
  const byId = useMemo(() => Object.fromEntries(allQuestions.map((q) => [q.id, q])), [allQuestions]);
  const selectedSet = useMemo(() => new Set(value), [value]);
  const [openCours, setOpenCours] = useState(null);

  const toggle = (id) => {
    if (selectedSet.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const remove = (id) => onChange(value.filter((x) => x !== id));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section>
        <h3 className="title-display text-sm tracking-[0.3em] mb-3">Banque de questions</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {data.cours.filter((c) => c.questions.length > 0).map((c) => {
            const isOpen = openCours === c.id;
            return (
              <div key={c.id} className="border border-accent/20 rounded bg-bg/30">
                <button
                  type="button"
                  onClick={() => setOpenCours(isOpen ? null : c.id)}
                  className="w-full flex justify-between items-center px-3 py-2 text-left hover:bg-accent/5"
                >
                  <span className="text-sm">
                    <span className="text-accent font-bold mr-2">Cours {c.id}</span>
                    <span className="text-white/80">{c.titre}</span>
                  </span>
                  <span className="text-[10px] text-muted">{c.questions.length}</span>
                </button>
                {isOpen && (
                  <ul className="divide-y divide-accent/10 border-t border-accent/10">
                    {c.questions.map((q) => {
                      const picked = selectedSet.has(q.id);
                      return (
                        <li key={q.id} className="flex items-start gap-2 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggle(q.id)}
                            className={`shrink-0 w-6 h-6 rounded text-sm font-bold ${picked ? 'bg-correct text-bg' : 'border border-accent/40 text-accent hover:bg-accent/10'}`}
                            title={picked ? 'Retirer' : 'Ajouter'}
                          >
                            {picked ? '✓' : '+'}
                          </button>
                          <span className={`shrink-0 text-[9px] uppercase px-2 py-0.5 rounded ${difficulteColor[q.difficulte] || ''}`}>
                            {q.difficulte}
                          </span>
                          <span className="text-xs text-white/80 leading-snug">{q.question}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="title-display text-sm tracking-[0.3em] mb-3">
          Questions sélectionnées ({value.length})
        </h3>
        {value.length === 0 ? (
          <p className="text-muted text-sm italic">Aucune question.</p>
        ) : (
          <ol className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {value.map((qid, idx) => {
              const q = byId[qid];
              if (!q) return (
                <li key={qid} className="border border-incorrect/40 rounded p-2 text-xs text-incorrect">
                  ⚠ Question introuvable: {qid}
                  <button type="button" onClick={() => remove(qid)} className="ml-2 underline">retirer</button>
                </li>
              );
              return (
                <li key={qid} className="border border-accent/20 rounded p-2 bg-bg/30 flex gap-2 items-start">
                  <span className="text-[10px] text-accent font-bold mt-1 w-6">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-[9px] text-muted uppercase tracking-widest">Cours {q.cours}</span>
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded ${difficulteColor[q.difficulte] || ''}`}>{q.difficulte}</span>
                    </div>
                    <p className="text-xs text-white/80 leading-snug">{q.question}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => move(idx, -1)} className="text-xs text-accent hover:text-white">↑</button>
                    <button type="button" onClick={() => move(idx, 1)} className="text-xs text-accent hover:text-white">↓</button>
                    <button type="button" onClick={() => remove(qid)} className="text-xs text-incorrect hover:text-white">✕</button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
