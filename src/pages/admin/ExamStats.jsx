import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

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
  const [exam, setExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [grades, setGrades] = useState([]);
  const [actors, setActors] = useState({});
  const [correctorsCount, setCorrectorsCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterField, setFilterField] = useState('');

  useEffect(() => {
    (async () => {
      let { data: ex, error: ee } = await supabase
        .from('exams')
        .select('id, title, slug, tenant_id, pre_form_schema, questions_snapshot')
        .eq('id', id).maybeSingle();
      if (ee && /column .* does not exist/i.test(ee.message || '')) {
        const fb = await supabase.from('exams').select('id, title, slug, question_ids').eq('id', id).maybeSingle();
        ex = fb.data ? { ...fb.data, tenant_id: null, pre_form_schema: null, questions_snapshot: null } : null;
        ee = fb.error;
      }
      if (ee || !ex) { setError(ee?.message || 'Examen introuvable.'); setLoading(false); return; }
      setExam(ex);

      const [{ data: cands }, { data: atts }, { data: gradeLogs }] = await Promise.all([
        supabase.from('candidates').select('id, full_name, pre_form_data').eq('exam_id', id),
        supabase.from('attempts').select('candidate_id, score, total, submitted_at, started_at, answers').eq('exam_id', id),
        supabase.from('activity_log').select('actor_id, created_at').eq('exam_id', id).eq('action', 'grade')
      ]);
      setCandidates(cands || []);
      setAttempts(atts || []);
      setGrades(gradeLogs || []);

      // Correcteurs du tenant (best-effort: visible aux admins/owners).
      if (ex.tenant_id) {
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name, email, role').eq('tenant_id', ex.tenant_id);
        if (profs) {
          setActors(Object.fromEntries(profs.map((p) => [p.id, profileLabel(p)])));
          setCorrectorsCount(profs.filter((p) => p.role === 'correcteur').length);
        }
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

  const perCorrector = useMemo(() => {
    const m = new Map();
    for (const g of grades) {
      const k = g.actor_id || '—';
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count);
  }, [grades]);

  // Champs catégoriels du formulaire d'entrée (select/radio) → filtrables.
  const categoricalFields = useMemo(
    () => (exam?.pre_form_schema || []).filter((f) => f.type === 'select' || f.type === 'radio'),
    [exam]
  );

  const breakdown = useMemo(() => {
    if (!filterField) return null;
    const groups = new Map();
    for (const c of candidates) {
      const val = c.pre_form_data?.[filterField] ?? '(non renseigné)';
      if (!groups.has(val)) groups.set(val, { value: val, inscrits: 0, soumis: 0, sumPct: 0 });
      const g = groups.get(val);
      g.inscrits += 1;
      const at = stats.attByCand.get(c.id);
      if (at?.submitted_at) {
        g.soumis += 1;
        g.sumPct += at.total > 0 ? (at.score / at.total) * 100 : 0;
      }
    }
    return [...groups.values()].map((g) => ({ ...g, avg: g.soumis ? g.sumPct / g.soumis : null }));
  }, [filterField, candidates, stats]);

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

      <section className="card">
        <h2 className="title-display text-lg mb-3">Corrections par correcteur</h2>
        <p className="text-xs text-muted mb-3">
          {correctorsCount !== null ? `${correctorsCount} correcteur(s) dans l'instance · ` : ''}
          {grades.length} correction(s) enregistrée(s) au total.
        </p>
        {perCorrector.length === 0 ? (
          <p className="text-muted text-sm italic">Aucune correction enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
              <th className="py-2 pr-3">Correcteur</th><th className="py-2 pr-3">Corrections</th>
            </tr></thead>
            <tbody className="divide-y divide-accent/10">
              {perCorrector.map((r) => (
                <tr key={r.actorId}>
                  <td className="py-2 pr-3 text-white">{actors[r.actorId] || r.actorId}</td>
                  <td className="py-2 pr-3 font-bold">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="title-display text-lg">Répartition par champ du formulaire</h2>
          <select
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
            className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
          >
            <option value="">— choisir un champ —</option>
            {categoricalFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        {categoricalFields.length === 0 ? (
          <p className="text-muted text-sm italic">Aucun champ filtrable (select/choix unique) dans le formulaire avant-examen.</p>
        ) : !breakdown ? (
          <p className="text-muted text-sm italic">Choisissez un champ pour voir la répartition.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
              <th className="py-2 pr-3">Valeur</th><th className="py-2 pr-3">Inscrits</th>
              <th className="py-2 pr-3">Soumis</th><th className="py-2 pr-3">Score moyen</th>
            </tr></thead>
            <tbody className="divide-y divide-accent/10">
              {breakdown.map((g) => (
                <tr key={String(g.value)}>
                  <td className="py-2 pr-3 text-white">{String(g.value)}</td>
                  <td className="py-2 pr-3">{g.inscrits}</td>
                  <td className="py-2 pr-3">{g.soumis}</td>
                  <td className="py-2 pr-3 text-accent">{g.avg === null ? '—' : `${fmtNum(g.avg)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
