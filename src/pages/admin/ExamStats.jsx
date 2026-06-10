import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';

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

      const [{ data: cands }, { data: atts }] = await Promise.all([
        supabase.from('candidates').select('id, full_name, pre_form_data').eq('exam_id', id),
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
