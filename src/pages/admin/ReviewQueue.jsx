import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';
import { tallyScore } from '../../utils/questionModel.js';

// File des réponses ouvertes « à revoir » (needsReview && pas encore corrigées),
// agrégées sur toutes les copies, groupables par élève ou par question, corrigeables sur place.
export default function ReviewQueue() {
  const { id } = useParams();
  const { session } = useAuth();
  const uid = session?.user?.id || null;
  const [exam, setExam] = useState(null);
  const [attempts, setAttempts] = useState({}); // attemptId -> { answers, candidate_id }
  const [names, setNames] = useState({}); // candId -> full_name
  const [items, setItems] = useState([]);
  const [groupBy, setGroupBy] = useState('eleve'); // 'eleve' | 'question'
  const [drafts, setDrafts] = useState({}); // key -> { points, note }
  const [savingKey, setSavingKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: ex } = await supabase
        .from('exams').select('id, title, slug, questions_snapshot').eq('id', id).maybeSingle();
      setExam(ex);
      const qById = new Map((Array.isArray(ex?.questions_snapshot) ? ex.questions_snapshot : []).map((q, i) => [q.id, { ...q, n: i + 1 }]));

      const [{ data: cands }, { data: atts, error: ae }] = await Promise.all([
        supabase.from('candidates').select('id, full_name').eq('exam_id', id),
        supabase.from('attempts').select('id, candidate_id, answers, score, total, submitted_at').eq('exam_id', id)
      ]);
      if (ae) { setError(ae.message); setLoading(false); return; }
      setNames(Object.fromEntries((cands || []).map((c) => [c.id, c.full_name])));

      const amap = {};
      const list = [];
      for (const a of atts || []) {
        if (!a.submitted_at || !Array.isArray(a.answers)) continue;
        amap[a.id] = { answers: a.answers, candidate_id: a.candidate_id };
        a.answers.forEach((ans) => {
          if (ans?.needsReview && !ans?.correction) {
            const q = qById.get(ans.questionId);
            list.push({
              key: `${a.id}:${ans.questionId}`,
              attemptId: a.id,
              candId: a.candidate_id,
              qid: ans.questionId,
              n: q?.n || 0,
              question: q?.question || ans.questionId,
              modelAnswer: q?.modelAnswer || null,
              reponse: ans.reponseTexte || '',
              auto: typeof ans.pointsObtenus === 'number' ? ans.pointsObtenus : 0,
              max: typeof ans.pointsMax === 'number' ? ans.pointsMax : 1
            });
          }
        });
      }
      setAttempts(amap);
      setItems(list);
      setLoading(false);
    })();
  }, [id]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const gk = groupBy === 'eleve' ? it.candId : it.qid;
      const label = groupBy === 'eleve' ? (names[it.candId] || it.candId) : `Q${it.n} — ${it.question}`;
      if (!m.has(gk)) m.set(gk, { label, items: [] });
      m.get(gk).items.push(it);
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [items, groupBy, names]);

  const save = async (it) => {
    const draft = drafts[it.key] || {};
    const ptsRaw = draft.points != null ? draft.points : it.auto;
    let pts = Number(ptsRaw);
    if (Number.isNaN(pts)) pts = 0;
    pts = Math.max(0, Math.min(pts, it.max));
    setSavingKey(it.key);
    setError(null);
    try {
      const cur = attempts[it.attemptId];
      const next = cur.answers.map((a) =>
        a.questionId === it.qid
          ? { ...a, correction: { points: pts, by: uid, at: new Date().toISOString(), note: draft.note || null } }
          : a
      );
      const { score, total } = tallyScore(next);
      const { error: e } = await supabase.from('attempts').update({ answers: next, score, total }).eq('id', it.attemptId);
      if (e) { setError(e.message); return; }
      setAttempts((p) => ({ ...p, [it.attemptId]: { ...cur, answers: next } }));
      setItems((p) => p.filter((x) => x.key !== it.key));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="title-display text-2xl">Réponses à revoir</h1>
          <p className="text-xs text-muted">{exam?.title} · {items.length} réponse(s) en attente</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/exams/${id}/results`} className="btn-secondary">← Entrées</Link>
        </div>
      </div>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {items.length === 0 ? (
        <p className="text-muted italic">Aucune réponse à revoir. Tout est corrigé. ✓</p>
      ) : (
        <>
          <div className="flex gap-2 mb-4 items-center">
            <span className="text-[10px] uppercase tracking-widest text-accent">Grouper par</span>
            <button type="button" onClick={() => setGroupBy('eleve')}
              className={`text-xs px-3 py-1 rounded border ${groupBy === 'eleve' ? 'border-accent text-accent' : 'border-accent/30 text-muted'}`}>Élève</button>
            <button type="button" onClick={() => setGroupBy('question')}
              className={`text-xs px-3 py-1 rounded border ${groupBy === 'question' ? 'border-accent text-accent' : 'border-accent/30 text-muted'}`}>Question</button>
          </div>

          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.label} className="card">
                <h2 className="title-display text-base border-b border-accent/20 pb-2 mb-3">
                  {g.label} <span className="text-xs text-accent">({g.items.length})</span>
                </h2>
                <div className="space-y-4">
                  {g.items.map((it) => {
                    const d = drafts[it.key] || {};
                    return (
                      <div key={it.key} className="border-l-2 border-moyenne/50 pl-3">
                        <p className="text-xs text-muted mb-1">
                          {groupBy === 'eleve' ? `Q${it.n} — ${it.question}` : (names[it.candId] || it.candId)}
                        </p>
                        {it.modelAnswer && <p className="text-[11px] text-accent mb-1">Attendu : {it.modelAnswer}</p>}
                        <p className="text-sm text-white whitespace-pre-wrap bg-bg/40 rounded p-2 mb-2">{it.reponse || <span className="text-muted italic">(vide)</span>}</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <label className="text-[10px] uppercase text-muted">Points /{it.max}</label>
                          <input
                            type="number" step="0.5" min="0" max={it.max}
                            value={d.points != null ? d.points : it.auto}
                            onChange={(e) => setDrafts((p) => ({ ...p, [it.key]: { ...d, points: e.target.value } }))}
                            className="w-20 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm focus:border-accent outline-none"
                          />
                          <input
                            type="text" placeholder="Note (optionnel)"
                            value={d.note || ''}
                            onChange={(e) => setDrafts((p) => ({ ...p, [it.key]: { ...d, note: e.target.value } }))}
                            className="flex-1 min-w-[140px] bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm focus:border-accent outline-none"
                          />
                          <button type="button" className="btn-primary text-xs" disabled={savingKey === it.key} onClick={() => save(it)}>
                            {savingKey === it.key ? '…' : 'Valider'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
