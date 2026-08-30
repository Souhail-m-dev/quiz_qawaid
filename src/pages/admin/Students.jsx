import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';

const STATUS_LABELS = { pending: 'En attente', approved: 'Validé', rejected: 'Refusé' };
const TABS = ['pending', 'approved', 'rejected'];

// Gestion des élèves: validation des inscriptions + attribution des matières.
export default function Students() {
  const { isPlatformAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [classes, setClasses] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    const [{ data, error: e }, { data: mats }, { data: cls }] = await Promise.all([
      supabase.rpc('list_students'),
      supabase.from('matieres').select('id, name, tenant_id').order('position').order('name'),
      supabase.from('classes').select('id, name, tenant_id').order('position').order('name')
    ]);
    if (e) setError(e.message);
    else setRows(data || []);
    setMatieres(mats || []);
    setClasses(cls || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((s) => [s, rows.filter((r) => r.status === s).length])),
    [rows]
  );
  const visible = rows.filter((r) => r.status === tab);

  const setStatus = async (r, status) => {
    setSavingId(r.id);
    setError(null);
    const { error: e } = await supabase.rpc('set_student_status', { p_id: r.id, p_status: status });
    setSavingId(null);
    if (e) { setError(e.message); return; }
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status } : x)));
  };

  const setClasse = async (r, classId) => {
    setSavingId(r.id);
    setError(null);
    const { error: e } = await supabase.rpc('set_student_class', { p_id: r.id, p_class_id: classId || null });
    setSavingId(null);
    if (e) { setError(e.message); return; }
    const cl = classes.find((c) => c.id === classId);
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, class_id: classId || null, class_name: cl?.name || null } : x)));
  };

  const toggleMatiere = async (r, matiereId) => {
    const current = r.matiere_ids || [];
    const next = current.includes(matiereId)
      ? current.filter((id) => id !== matiereId)
      : [...current, matiereId];
    setSavingId(r.id);
    setError(null);
    const { error: e } = await supabase.rpc('set_student_matieres', { p_id: r.id, p_matiere_ids: next });
    setSavingId(null);
    if (e) { setError(e.message); return; }
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, matiere_ids: next } : x)));
  };

  // Un admin plateforme voit plusieurs instances: n'offrir que les matières du tenant de l'élève.
  const matieresFor = (r) =>
    isPlatformAdmin ? matieres.filter((m) => m.tenant_id === r.tenant_id) : matieres;
  const classesFor = (r) =>
    isPlatformAdmin ? classes.filter((c) => c.tenant_id === r.tenant_id) : classes;

  const labelFor = (r) => r.full_name || r.email || r.id;

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="title-display text-2xl">Élèves</h1>
        <Link to="/admin" className="btn-secondary">← Retour</Link>
      </div>

      <p className="text-xs text-muted mb-4">
        Les élèves s'inscrivent seuls depuis <span className="text-accent">/eleve/inscription</span>.
        Validez l'inscription, puis rattachez l'élève à une <Link to="/admin/classes" className="text-accent underline">classe</Link> :
        il accède aux matières de sa classe, et donc à leurs cours et examens. Les matières cochées
        ici s'ajoutent à celles de la classe.
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded text-xs uppercase tracking-widest transition ${
              tab === s ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {STATUS_LABELS[s]} ({counts[s] || 0})
          </button>
        ))}
      </div>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {visible.length === 0 ? (
        <p className="text-muted italic">Aucun élève {STATUS_LABELS[tab].toLowerCase()}.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-accent/20 text-accent uppercase tracking-widest text-[10px]">
                <th className="py-2 pr-3">Élève</th>
                <th className="py-2 pr-3">Classe</th>
                <th className="py-2 pr-3">Matières en plus</th>
                <th className="py-2 pr-3">Résultats</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 pr-3 align-top">
                    <Link to={`/admin/eleves/${r.id}`} className="text-white hover:text-accent transition">
                      {labelFor(r)}
                    </Link>
                    <p className="text-[10px] text-muted">{r.email}</p>
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <select
                      value={r.class_id || ''}
                      disabled={savingId === r.id}
                      onChange={(e) => setClasse(r, e.target.value)}
                      className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-xs focus:border-accent outline-none"
                    >
                      <option value="">— Aucune —</option>
                      {classesFor(r).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {matieresFor(r).length === 0 ? (
                        <span className="text-[10px] text-muted">Aucune matière dans l'instance</span>
                      ) : (
                        matieresFor(r).map((m) => {
                          const on = (r.matiere_ids || []).includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={savingId === r.id}
                              onClick={() => toggleMatiere(r, m.id)}
                              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded border transition ${
                                on
                                  ? 'border-accent/50 bg-accent/15 text-accent'
                                  : 'border-accent/20 text-muted hover:text-white'
                              }`}
                            >
                              {on ? '✓ ' : ''}{m.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top text-muted">
                    {r.exams_done > 0 ? (
                      <>
                        {r.exams_done} examen(s)
                        {r.avg_pct !== null && <span className="text-accent"> · {r.avg_pct}%</span>}
                      </>
                    ) : '—'}
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <div className="flex gap-2 flex-wrap">
                      {r.status !== 'approved' && (
                        <button
                          type="button"
                          disabled={savingId === r.id}
                          onClick={() => setStatus(r, 'approved')}
                          className="text-xs text-correct hover:underline"
                        >
                          Valider
                        </button>
                      )}
                      {r.status !== 'rejected' && (
                        <button
                          type="button"
                          disabled={savingId === r.id}
                          onClick={() => setStatus(r, 'rejected')}
                          className="text-xs text-incorrect hover:underline"
                        >
                          Refuser
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
