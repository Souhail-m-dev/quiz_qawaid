import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const ACTION_LABELS = {
  register: 'Inscription',
  submit: 'Soumission',
  grade: 'Correction',
  certificate_download: 'Certificat (téléch.)',
  certificate_email: 'Certificat (email)'
};

export default function Activity() {
  const [rows, setRows] = useState([]);
  const [exams, setExams] = useState({});
  const [actors, setActors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from('activity_log')
        .select('id, actor_id, actor_role, action, exam_id, candidate_id, attempt_id, meta, created_at')
        .order('created_at', { ascending: false })
        .limit(300);
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      setRows(data || []);

      const examIds = [...new Set((data || []).map((r) => r.exam_id).filter(Boolean))];
      const actorIds = [...new Set((data || []).map((r) => r.actor_id).filter(Boolean))];
      if (examIds.length) {
        const { data: ex } = await supabase.from('exams').select('id, title').in('id', examIds);
        setExams(Object.fromEntries((ex || []).map((x) => [x.id, x.title])));
      }
      if (actorIds.length) {
        const { data: pr } = await supabase.from('profiles').select('*').in('id', actorIds);
        setActors(Object.fromEntries((pr || []).map((p) => [p.id, p.full_name || p.email || p.id])));
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (filterAction ? rows.filter((r) => r.action === filterAction) : rows),
    [rows, filterAction]
  );

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="title-display text-2xl">Journal d'activité</h1>
        <Link to="/admin" className="btn-secondary">← Retour</Link>
      </div>

      <div className="card mb-4 flex items-center gap-3">
        <label className="text-xs uppercase tracking-widest text-accent">Action</label>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white focus:border-accent outline-none"
        >
          <option value="">Toutes</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {filtered.length === 0 ? (
        <p className="text-muted italic">Aucune activité.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-accent/20 text-accent uppercase tracking-widest text-[10px]">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Acteur</th>
                <th className="py-2 pr-3">Rôle</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Examen</th>
                <th className="py-2 pr-3">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-muted whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="py-2 pr-3 text-white">{r.actor_id ? (actors[r.actor_id] || r.actor_id) : 'Système / élève'}</td>
                  <td className="py-2 pr-3 text-muted">{r.actor_role || '—'}</td>
                  <td className="py-2 pr-3">{ACTION_LABELS[r.action] || r.action}</td>
                  <td className="py-2 pr-3 text-white/80">{r.exam_id ? (exams[r.exam_id] || r.exam_id) : '—'}</td>
                  <td className="py-2 pr-3 text-muted text-xs">
                    {r.meta ? JSON.stringify(r.meta) : '—'}
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
