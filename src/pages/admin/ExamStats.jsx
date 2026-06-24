import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';
import { effectivePoints, getType } from '../../utils/questionModel.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtNum(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function Kpi({ label, value, accent }) {
  return (
    <div className="card text-center py-5">
      <div className={`text-3xl font-bold ${accent || 'text-white'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted mt-1">{label}</div>
    </div>
  );
}

const profileLabel = (p) => p?.full_name || p?.email || p?.username || p?.id || '—';

export default function ExamStats() {
  const { id } = useParams();
  const { isAdmin, isPlatformAdmin } = useAuth();
  const canSeeCorrectors = isAdmin || isPlatformAdmin; // owner / plateforme uniquement
  const [exam, setExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [actors, setActors] = useState({});
  const [correctorsCount, setCorrectorsCount] = useState(null);
  const [showCorr, setShowCorr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    (async () => {
      let { data: ex, error: ee } = await supabase
        .from('exams')
        .select('id, title, slug, tenant_id, pre_form_schema, post_form_schema, questions_snapshot')
        .eq('id', id).maybeSingle();
      if (ee && /column .* does not exist/i.test(ee.message || '')) {
        const fb = await supabase.from('exams').select('id, title, slug, question_ids').eq('id', id).maybeSingle();
        ex = fb.data ? { ...fb.data, tenant_id: null, pre_form_schema: null, post_form_schema: null, questions_snapshot: null } : null;
        ee = fb.error;
      }
      if (ee || !ex) { setError(ee?.message || 'Examen introuvable.'); setLoading(false); return; }
      setExam(ex);

      const [{ data: cands }, { data: atts }] = await Promise.all([
        supabase.from('candidates').select('id, full_name, pre_form_data, post_form_data').eq('exam_id', id),
        supabase.from('attempts').select('candidate_id, score, total, submitted_at, started_at, answers').eq('exam_id', id)
      ]);
      setCandidates(cands || []);
      setAttempts(atts || []);

      // Noms des membres via RPC (joint auth.users -> email/nom). profiles seul
      // ne porte pas email/full_name, d'où l'UUID affiché auparavant.
      const { data: members } = await supabase.rpc('list_members');
      if (members) {
        setActors(Object.fromEntries(members.map((m) => [m.id, m.full_name || m.email || m.id])));
        setCorrectorsCount(members.filter((m) => m.role === 'correcteur').length);
      }
      setLoading(false);
    })();
  }, [id]);

  const stats = useMemo(() => {
    const attByCand = new Map(attempts.map((a) => [a.candidate_id, a]));
    const submitted = attempts.filter((a) => a.submitted_at);
    const inProgress = attempts.filter((a) => !a.submitted_at);
    const avg = submitted.length
      ? submitted.reduce((s, a) => s + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0) / submitted.length
      : null;

    // À corriger: tentatives soumises avec au moins une réponse ouverte non corrigée
    // signalée needsReview.
    const toReview = submitted.filter((a) =>
      Array.isArray(a.answers) && a.answers.some((ans) => ans?.needsReview && !ans?.correction)
    ).length;

    // Entrées corrigées: tentatives avec au moins une correction manuelle.
    const correctedAttempts = submitted.filter((a) =>
      Array.isArray(a.answers) && a.answers.some((ans) => ans?.correction)
    ).length;

    return { attByCand, submittedCount: submitted.length, inProgress: inProgress.length, avg, toReview, correctedAttempts };
  }, [attempts]);

  // Corrections réelles (attempts.answers[].correction). Regroupées PAR TENTATIVE
  // et par correcteur: une "correction" = un correcteur a corrigé la copie d'un
  // élève (peu importe le nombre de questions touchées dans cette copie).
  const corrections = useMemo(() => {
    const candName = new Map(candidates.map((c) => [c.id, c.full_name]));
    const map = new Map(); // clé: by|candidate_id
    for (const a of attempts) {
      if (!Array.isArray(a.answers)) continue;
      for (const ans of a.answers) {
        if (!ans?.correction) continue;
        const by = ans.correction.by || '—';
        const key = `${by}|${a.candidate_id}`;
        if (!map.has(key)) {
          map.set(key, {
            by,
            candidate: candName.get(a.candidate_id) || a.candidate_id,
            questions: 0,
            lastAt: null
          });
        }
        const e = map.get(key);
        e.questions += 1;
        const at = ans.correction.at;
        if (at && (!e.lastAt || String(at) > String(e.lastAt))) e.lastAt = at;
      }
    }
    return [...map.values()];
  }, [attempts, candidates]);

  // Par correcteur: nb de copies corrigées + détail des copies.
  const perCorrector = useMemo(() => {
    const m = new Map();
    for (const c of corrections) {
      if (!m.has(c.by)) m.set(c.by, { actorId: c.by, attempts: 0, items: [] });
      const g = m.get(c.by);
      g.attempts += 1;
      g.items.push(c);
    }
    for (const g of m.values()) {
      g.items.sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
    }
    return [...m.values()].sort((a, b) => b.attempts - a.attempts);
  }, [corrections]);

  // Stat par question: agrège attempts.answers (réponses soumises) par questionId.
  // Taux de réussite = points obtenus (override correcteur prioritaire) / points max.
  const perQuestion = useMemo(() => {
    const questions = Array.isArray(exam?.questions_snapshot) ? exam.questions_snapshot : [];
    if (questions.length === 0) return [];
    const agg = new Map(); // questionId -> { answered, correct, sumPct, needsReview }
    for (const a of attempts) {
      if (!a.submitted_at || !Array.isArray(a.answers)) continue;
      for (const ans of a.answers) {
        const qid = ans?.questionId;
        if (qid == null) continue;
        if (!agg.has(qid)) agg.set(qid, { answered: 0, correct: 0, sumPct: 0, needsReview: 0 });
        const e = agg.get(qid);
        e.answered += 1;
        const max = typeof ans?.pointsMax === 'number' ? ans.pointsMax : 1;
        const pct = max > 0 ? (effectivePoints(ans) / max) * 100 : 0;
        e.sumPct += pct;
        if (pct >= 100) e.correct += 1;
        if (ans?.needsReview && !ans?.correction) e.needsReview += 1;
      }
    }
    return questions.map((q, i) => {
      const e = agg.get(q.id) || { answered: 0, correct: 0, sumPct: 0, needsReview: 0 };
      return {
        id: q.id,
        n: i + 1,
        label: q.question || `Question ${i + 1}`,
        type: getType(q),
        answered: e.answered,
        correct: e.correct,
        needsReview: e.needsReview,
        avg: e.answered ? e.sumPct / e.answered : null
      };
    });
  }, [exam, attempts]);

  // Colonnes formulaire dédupliquées par clé (source:key) — avant puis après examen.
  // La déduplication évite de répéter à l'identique des champs de même clé (bug Miloud:
  // 6 champs partageaient la clé "champ", leurs réponses fusionnent dans une seule colonne).
  // Colonnes formulaire (pré + post), cases à cocher exclues. NON dédupliquées:
  // si plusieurs champs partagent une clé (collision pre_form_data), on les garde
  // séparés et on route chaque valeur stockée vers le bon champ (options/type/libellé).
  const formCols = useMemo(() => {
    const out = [];
    for (const [src, schema] of [['pre', exam?.pre_form_schema], ['post', exam?.post_form_schema]]) {
      (schema || []).forEach((f, i) => {
        if (f.type === 'checkbox') return; // engagement/consentement masqué
        out.push({
          id: `${src}:${f.key}:${i}`,
          source: src, key: f.key, type: f.type,
          rawLabel: f.label,
          label: src === 'post' ? `${f.label} (après)` : f.label,
          options: f.options || []
        });
      });
    }
    return out;
  }, [exam]);

  // Nb de colonnes par clé → collision si > 1.
  const keyCount = useMemo(() => {
    const m = {};
    for (const c of formCols) { const k = `${c.source}:${c.key}`; m[k] = (m[k] || 0) + 1; }
    return m;
  }, [formCols]);

  // Champs catégoriels (select/radio) → proposés comme filtre.
  const filterableFields = useMemo(
    () => formCols.filter((f) => f.type === 'select' || f.type === 'radio'),
    [formCols]
  );

  const isDateLike = (s) => /^\d{1,2}[/.\- ]\d{1,2}[/.\- ]\d{2,4}$/.test(String(s).trim());

  // Colonne (id) à laquelle appartient une valeur fusionnée.
  const routeTo = (val, siblings) => {
    const byOption = siblings.find((f) => f.options.includes(val));
    if (byOption) return byOption.id;
    if (isDateLike(val)) {
      const d = siblings.find((f) => /naiss|date/i.test(f.rawLabel));
      if (d) return d.id;
    }
    const abs = siblings.find((f) => /absen|combien|nombre/i.test(f.rawLabel));
    if (abs) return abs.id;
    const txt = siblings.find((f) => ['text', 'textarea', 'tel', 'email', 'number'].includes(f.type));
    return (txt || siblings[0]).id;
  };

  // Valeur affichée d'une cellule: route les valeurs fusionnées vers la bonne colonne.
  const cellValue = (c, col) => {
    const raw = (col.source === 'post' ? c.post_form_data : c.pre_form_data)?.[col.key];
    if (raw == null || raw === '') return '';
    const fmt = (v) => (typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : String(v));
    if (keyCount[`${col.source}:${col.key}`] <= 1) {
      return Array.isArray(raw) ? raw.map(fmt).join(', ') : fmt(raw);
    }
    const elems = (Array.isArray(raw) ? raw : [raw])
      .map((e) => (typeof e === 'boolean' ? (e ? 'on' : '') : String(e)))
      .filter((e) => e !== '');
    const siblings = formCols.filter((f) => f.source === col.source && f.key === col.key);
    return elems.filter((e) => routeTo(e, siblings) === col.id).join(', ');
  };

  // Filtre par colonne (filterField = col.id).
  const fCol = formCols.find((f) => f.id === filterField) || null;
  const filterValues = useMemo(() => {
    if (!fCol) return [];
    return [...new Set(candidates.map((c) => cellValue(c, fCol)).filter((v) => v !== ''))].sort();
  }, [candidates, fCol]);

  // Une ligne par inscrit, filtrée puis triée par nom.
  const personRows = useMemo(() => {
    let out = candidates;
    if (fCol && filterValue) out = out.filter((c) => cellValue(c, fCol) === filterValue);
    return [...out].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [candidates, fCol, filterValue]);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (error) return <p className="text-incorrect p-10">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-display text-2xl">{exam.title}</h1>
          <p className="text-xs text-muted">Statistiques · /exam/{exam.slug}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/exams/${id}/results`} className="btn-secondary">Entrées / corriger →</Link>
          <Link to="/admin" className="btn-secondary">← Tableau de bord</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Inscrits" value={candidates.length} />
        <Kpi label="Soumis" value={stats.submittedCount} accent="text-correct" />
        <Kpi label="En cours" value={stats.inProgress} accent="text-moyenne" />
        <Kpi label="À corriger" value={stats.toReview} accent={stats.toReview ? 'text-incorrect' : 'text-white'} />
        <Kpi label="Corrigées" value={stats.correctedAttempts} />
        <Kpi label="Score moyen" value={stats.avg === null ? '—' : `${fmtNum(stats.avg)}%`} accent="text-accent" />
      </div>

      {canSeeCorrectors && (
        <section className="card">
          <button
            type="button"
            onClick={() => setShowCorr((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="title-display text-lg">Corrections par correcteur</h2>
              <p className="text-xs text-muted mt-1">
                {corrections.length} copie(s) corrigée(s) · {perCorrector.length} correcteur(s) actif(s)
                {correctorsCount !== null ? ` · ${correctorsCount} dans l'instance` : ''}
              </p>
            </div>
            <span className="text-accent text-sm shrink-0">{showCorr ? '▲ Masquer' : '▼ Détail'}</span>
          </button>

          {showCorr && (
            perCorrector.length === 0 ? (
              <p className="text-muted text-sm italic mt-4">Aucune correction enregistrée.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {perCorrector.map((g) => (
                  <div key={g.actorId}>
                    <div className="flex items-baseline justify-between border-b border-accent/20 pb-1 mb-2">
                      <span className="text-white font-bold">{actors[g.actorId] || g.actorId}</span>
                      <span className="text-xs text-accent">{g.attempts} copie(s)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/10">
                          <th className="py-1 pr-3">Candidat</th><th className="py-1 pr-3">Réponses corrigées</th><th className="py-1 pr-3">Dernière correction</th>
                        </tr></thead>
                        <tbody className="divide-y divide-accent/10">
                          {g.items.map((c, i) => (
                            <tr key={i}>
                              <td className="py-1.5 pr-3 text-white">{c.candidate}</td>
                              <td className="py-1.5 pr-3">{c.questions}</td>
                              <td className="py-1.5 pr-3 text-muted">{formatDate(c.lastAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      )}

      <section className="card">
        <h2 className="title-display text-lg mb-3">Statistiques par question</h2>
        {perQuestion.length === 0 ? (
          <p className="text-muted text-sm italic">Aucune question enregistrée pour cet examen.</p>
        ) : stats.submittedCount === 0 ? (
          <p className="text-muted text-sm italic">Aucune copie soumise.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Question</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Répondu</th>
                <th className="py-2 pr-3">Réussite</th>
                <th className="py-2 pr-3">Taux moyen</th>
                <th className="py-2 pr-3">À corriger</th>
              </tr></thead>
              <tbody className="divide-y divide-accent/10">
                {perQuestion.map((q) => (
                  <tr key={q.id}>
                    <td className="py-2 pr-3 text-muted">{q.n}</td>
                    <td className="py-2 pr-3 text-white max-w-md truncate" title={q.label}>{q.label}</td>
                    <td className="py-2 pr-3 text-muted">{q.type === 'open' ? 'Ouverte' : 'Choix'}</td>
                    <td className="py-2 pr-3">{q.answered}</td>
                    <td className="py-2 pr-3">{q.answered ? `${q.correct}/${q.answered}` : '—'}</td>
                    <td className="py-2 pr-3 text-accent">{q.avg === null ? '—' : `${fmtNum(q.avg)}%`}</td>
                    <td className="py-2 pr-3">
                      {q.needsReview ? <span className="text-incorrect">{q.needsReview}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h2 className="title-display text-lg">Réponses formulaire par personne</h2>
          {filterableFields.length > 0 && (
            <>
              <select
                value={filterField}
                onChange={(e) => { setFilterField(e.target.value); setFilterValue(''); }}
                className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
              >
                <option value="">— filtrer par champ —</option>
                {filterableFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              {filterField && (
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
                >
                  <option value="">Toutes les valeurs</option>
                  {filterValues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </>
          )}
          <span className="text-xs text-muted ml-auto self-center">{personRows.length} / {candidates.length}</span>
        </div>
        <p className="text-xs text-muted mb-4">Une ligne par inscrit · une colonne par champ (avant/après). Les champs de même clé sont fusionnés.</p>
        {formCols.length === 0 ? (
          <p className="text-muted text-sm italic">Aucun champ de formulaire sur cet examen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Score</th>
                {formCols.map((f) => <th key={f.id} className="py-2 pr-3 whitespace-nowrap">{f.label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-accent/10">
                {personRows.length === 0 ? (
                  <tr><td colSpan={2 + formCols.length} className="py-4 text-center text-muted italic">Aucun inscrit pour ce filtre.</td></tr>
                ) : personRows.map((c) => {
                  const a = stats.attByCand.get(c.id);
                  const pct = a?.submitted_at && a.total > 0 ? (a.score / a.total) * 100 : null;
                  return (
                    <tr key={c.id}>
                      <td className="py-2 pr-3 text-white whitespace-nowrap">{c.full_name}</td>
                      <td className="py-2 pr-3 text-accent">{pct == null ? '—' : `${fmtNum(pct)}%`}</td>
                      {formCols.map((f) => <td key={f.id} className="py-2 pr-3 whitespace-nowrap">{cellValue(c, f) || '—'}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
