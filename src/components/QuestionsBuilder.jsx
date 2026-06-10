import React, { useEffect, useState } from 'react';
import { getType, getPoints } from '../utils/questionModel.js';
import { IconUp, IconDown, IconEdit, IconClose, IconPlus } from './icons.jsx';

const EDIT_KEY = 'quiz-qawaid:exam-editor-open-q';

const TYPE_BADGE = {
  mcq: { label: 'QCM', cls: 'bg-accent/20 text-accent' },
  truefalse: { label: 'Vrai / Faux', cls: 'bg-moyenne/20 text-moyenne' },
  open: { label: 'Ouverte', cls: 'bg-correct/20 text-correct' }
};

const newId = () => `inline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function blankQuestion(type) {
  if (type === 'open') {
    return {
      id: newId(), type: 'open', points: 1, question: '', justification: '',
      modelAnswer: '', grading: { mode: 'exact', acceptedAnswers: [] }
    };
  }
  if (type === 'truefalse') {
    return {
      id: newId(), type: 'truefalse', points: 1, question: '',
      options: ['Vrai', 'Faux'], reponseCorrecte: 0, justification: ''
    };
  }
  return {
    id: newId(), type: 'mcq', points: 1, question: '',
    options: ['', '', '', ''], reponseCorrecte: 0, justification: ''
  };
}

// Éditeur d'une question inline (type, points, contenu, correction).
function InlineEditor({ q, onChange }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const setGrading = (patch) => onChange({ ...q, grading: { ...q.grading, ...patch } });
  const type = getType(q);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => onChange({ ...blankQuestion(e.target.value), id: q.id, question: q.question, points: q.points, justification: q.justification })}
            className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
          >
            <option value="mcq">QCM</option>
            <option value="truefalse">Vrai / Faux</option>
            <option value="open">Ouverte</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Points</label>
          <input
            type="number" min="0" step="0.5" value={q.points}
            onChange={(e) => set({ points: Number(e.target.value) })}
            className="w-24 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Énoncé</label>
        <textarea
          value={q.question} onChange={(e) => set({ question: e.target.value })} rows={2}
          className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
        />
      </div>

      {(type === 'mcq' || type === 'truefalse') && (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-widest text-accent">Options (cocher la bonne)</label>
          {q.options.map((opt, i) => {
            const isCorrect = q.reponseCorrecte === i;
            return (
              <div key={i} className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition ${isCorrect ? 'bg-correct/10 ring-1 ring-correct/40' : ''}`}>
                <input
                  type="radio" name={`correct-${q.id}`} checked={isCorrect}
                  onChange={() => set({ reponseCorrecte: i })}
                  className="w-4 h-4 accent-correct shrink-0" title="Bonne réponse"
                />
                <input
                  value={opt} placeholder={`Option ${i + 1}`}
                  onChange={(e) => { const o = q.options.slice(); o[i] = e.target.value; set({ options: o }); }}
                  className="flex-1 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm focus:border-accent outline-none"
                />
                {type === 'mcq' && q.options.length > 2 && (
                  <button type="button" title="Supprimer l'option"
                    onClick={() => { const o = q.options.filter((_, j) => j !== i); set({ options: o, reponseCorrecte: Math.min(q.reponseCorrecte, o.length - 1) }); }}
                    className="icon-btn icon-btn-danger w-7 h-7 shrink-0"><IconClose /></button>
                )}
              </div>
            );
          })}
          {type === 'mcq' && (
            <button type="button" onClick={() => set({ options: [...q.options, ''] })} className="add-tile"><IconPlus />Option</button>
          )}
        </div>
      )}

      {type === 'open' && (
        <div className="space-y-3 border-t border-accent/10 pt-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Réponse de référence (affichée au correcteur)</label>
            <textarea
              value={q.modelAnswer || ''} onChange={(e) => set({ modelAnswer: e.target.value })} rows={2}
              className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Mode de correction auto</label>
            <select
              value={q.grading?.mode || 'exact'}
              onChange={(e) => {
                const mode = e.target.value;
                const base = mode === 'numeric' ? { mode, expected: 0, tolerance: 0 }
                  : mode === 'keywords' ? { mode, groups: [{ any: [], points: q.points }] }
                  : { mode, acceptedAnswers: [] };
                setGrading(base);
                onChange({ ...q, grading: base });
              }}
              className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
            >
              <option value="exact">Réponses acceptées (exact)</option>
              <option value="numeric">Numérique (± tolérance)</option>
              <option value="keywords">Mots-clés (crédit partiel)</option>
            </select>
          </div>

          {(q.grading?.mode || 'exact') === 'exact' && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Réponses acceptées (une par ligne)</label>
              <textarea
                value={(q.grading?.acceptedAnswers || []).join('\n')}
                onChange={(e) => setGrading({ acceptedAnswers: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                rows={3} placeholder={'oui\nvrai\ncorrect'}
                className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
              />
            </div>
          )}

          {q.grading?.mode === 'numeric' && (
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Attendu</label>
                <input type="number" step="any" value={q.grading.expected ?? 0}
                  onChange={(e) => setGrading({ expected: Number(e.target.value) })}
                  className="w-28 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Tolérance ±</label>
                <input type="number" step="any" value={q.grading.tolerance ?? 0}
                  onChange={(e) => setGrading({ tolerance: Number(e.target.value) })}
                  className="w-28 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Unité</label>
                <input value={q.grading.unit || ''} onChange={(e) => setGrading({ unit: e.target.value })}
                  className="w-24 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm" />
              </div>
            </div>
          )}

          {q.grading?.mode === 'keywords' && (
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-widest text-accent">Groupes de mots-clés</label>
              {(q.grading.groups || []).map((g, gi) => (
                <div key={gi} className="flex gap-2 items-center">
                  <input
                    value={(g.any || []).join(', ')}
                    placeholder="synonymes séparés par des virgules"
                    onChange={(e) => {
                      const groups = q.grading.groups.slice();
                      groups[gi] = { ...g, any: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) };
                      setGrading({ groups });
                    }}
                    className="flex-1 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
                  />
                  <input type="number" step="0.25" value={g.points ?? 0} title="points du groupe"
                    onChange={(e) => { const groups = q.grading.groups.slice(); groups[gi] = { ...g, points: Number(e.target.value) }; setGrading({ groups }); }}
                    className="w-20 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm focus:border-accent outline-none" />
                  <button type="button" title="Supprimer le groupe"
                    onClick={() => setGrading({ groups: q.grading.groups.filter((_, j) => j !== gi) })}
                    className="icon-btn icon-btn-danger w-7 h-7 shrink-0"><IconClose /></button>
                </div>
              ))}
              <button type="button" onClick={() => setGrading({ groups: [...(q.grading.groups || []), { any: [], points: 0 }] })} className="add-tile"><IconPlus />Groupe</button>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-accent mb-1 mt-2">Exiger au moins (N groupes, optionnel — barème « N sur M »)</label>
                <input type="number" min="0" value={q.grading.requireAtLeast ?? ''}
                  onChange={(e) => setGrading({ requireAtLeast: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-28 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm" />
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Justification (facultatif)</label>
        <textarea value={q.justification || ''} onChange={(e) => set({ justification: e.target.value })} rows={2}
          className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm" />
      </div>
    </div>
  );
}

// value = tableau d'objets question (snapshot). onChange(nextArray).
export default function QuestionsBuilder({ value = [], onChange }) {
  const [editingId, setEditingId] = useState(() => {
    try { return window.localStorage.getItem(EDIT_KEY) || null; } catch { return null; }
  });

  // Persiste l'éditeur ouvert pour le rouvrir après un éventuel reload.
  useEffect(() => {
    try {
      if (editingId) window.localStorage.setItem(EDIT_KEY, editingId);
      else window.localStorage.removeItem(EDIT_KEY);
    } catch { /* ignore */ }
  }, [editingId]);

  const addInline = (type) => {
    const q = blankQuestion(type);
    onChange([...value, q]);
    setEditingId(q.id);
  };
  const updateQ = (id, next) => onChange(value.map((q) => (q.id === id ? next : q)));
  const remove = (id) => onChange(value.filter((q) => q.id !== id));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-5">
      <section className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="title-display text-sm tracking-[0.3em] mb-1">Questions</h3>
          <p className="text-xs text-muted">Créez les questions propres à cet examen.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => addInline('mcq')} className="add-tile"><IconPlus />QCM</button>
          <button type="button" onClick={() => addInline('truefalse')} className="add-tile"><IconPlus />Vrai/Faux</button>
          <button type="button" onClick={() => addInline('open')} className="add-tile"><IconPlus />Ouverte</button>
        </div>
      </section>

      <section>
        <h3 className="title-display text-sm tracking-[0.3em] mb-3">Questions de l'examen ({value.length})</h3>
        {value.length === 0 ? (
          <p className="text-muted text-sm italic">Aucune question.</p>
        ) : (
          <ol className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {value.map((q, idx) => {
              const type = getType(q);
              const editing = editingId === q.id;
              const badge = TYPE_BADGE[type] || TYPE_BADGE.mcq;
              return (
                <li key={q.id} className={`rounded-lg bg-bg/40 border transition ${editing ? 'border-accent/60 shadow-gold' : 'border-accent/15 hover:border-accent/35'}`}>
                  <div className="flex gap-3 items-start p-3">
                    <span className="shrink-0 w-7 h-7 rounded-md bg-accent/10 text-accent text-xs font-bold flex items-center justify-center mt-0.5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 items-center mb-1 flex-wrap">
                        <span className={`pill ${badge.cls}`}>{badge.label}</span>
                        <span className="pill bg-white/5 text-muted">{getPoints(q)} pt</span>
                      </div>
                      <p className="text-sm text-white/85 leading-snug">{q.question || <em className="text-muted">(sans énoncé)</em>}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} className="icon-btn" title="Monter"><IconUp /></button>
                      <button type="button" disabled={idx === value.length - 1} onClick={() => move(idx, 1)} className="icon-btn" title="Descendre"><IconDown /></button>
                      <button type="button" onClick={() => setEditingId(editing ? null : q.id)} className={`icon-btn ${editing ? 'bg-accent/20 text-accent border-accent/50' : ''}`} title={editing ? 'Fermer' : 'Éditer'}><IconEdit /></button>
                      <button type="button" onClick={() => remove(q.id)} className="icon-btn icon-btn-danger" title="Supprimer"><IconClose /></button>
                    </div>
                  </div>
                  {editing && (
                    <div className="px-3 pb-3 pt-1 border-t border-accent/10">
                      <InlineEditor q={q} onChange={(next) => updateQ(q.id, next)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
