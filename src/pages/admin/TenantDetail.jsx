import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const ACTION_LABELS = {
  register: 'Inscription', submit: 'Soumission', grade: 'Correction',
  certificate_download: 'Certificat (téléch.)', certificate_email: 'Certificat (email)'
};

const profileLabel = (p) => p?.full_name || p?.email || p?.username || p?.id || '—';

export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [members, setMembers] = useState([]);
  const [exams, setExams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [actors, setActors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: t, error: te } = await supabase
        .from('tenants').select('id, name, owner_id, created_at').eq('id', tenantId).maybeSingle();
      if (te || !t) { setError(te?.message || 'Instance introuvable.'); setLoading(false); return; }
      setTenant(t);

      const [{ data: profiles }, { data: ex }, { data: lg }] = await Promise.all([
        supabase.from('profiles').select('*').eq('tenant_id', tenantId),
        supabase.from('exams')
          .select('id, title, slug, is_open, candidates(count), attempts(count)')
          .eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('activity_log')
          .select('id, actor_id, actor_role, action, exam_id, candidate_id, meta, created_at')
          .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100)
      ]);

      setMembers(profiles || []);
      setExams(ex || []);
      setLogs(lg || []);
      setActors(Object.fromEntries((profiles || []).map((p) => [p.id, profileLabel(p)])));
      setLoading(false);
    })();
  }, [tenantId]);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (error) return <p className="text-incorrect p-10">{error}</p>;

  const owner = members.find((m) => m.id === tenant.owner_id);
  const corrections = logs.filter((l) => l.action === 'grade');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="title-display text-2xl">{tenant.name}</h1>
          <p className="text-xs text-muted">Owner: {profileLabel(owner)} · créé le {formatDate(tenant.created_at)}</p>
        </div>
        <Link to="/admin/tenants" className="btn-secondary">← Instances</Link>
      </div>

      {/* Membres (owner + correcteurs) */}
      <section className="card">
        <h2 className="title-display text-lg mb-3">Membres ({members.length})</h2>
        {members.length === 0 ? <p className="text-muted text-sm italic">Aucun membre.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
              <th className="py-2 pr-3">Membre</th><th className="py-2 pr-3">Rôle</th>
            </tr></thead>
            <tbody className="divide-y divide-accent/10">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 text-white">{profileLabel(m)}{m.is_platform_admin && <span className="ml-2 text-[9px] uppercase px-2 py-0.5 rounded bg-accent/20 text-accent">plateforme</span>}</td>
                  <td className="py-2 pr-3 text-muted">{m.role || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Examens → résultats / correction */}
      <section className="card">
        <h2 className="title-display text-lg mb-3">Examens ({exams.length})</h2>
        {exams.length === 0 ? <p className="text-muted text-sm italic">Aucun examen.</p> : (
          <div className="grid gap-3">
            {exams.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border border-accent/15 rounded p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{e.title}</span>
                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded ${e.is_open ? 'bg-correct/20 text-correct' : 'bg-incorrect/20 text-incorrect'}`}>{e.is_open ? 'Ouvert' : 'Fermé'}</span>
                  </div>
                  <p className="text-xs text-muted">/exam/{e.slug} · {e.candidates?.[0]?.count ?? 0} inscrit(s) · {e.attempts?.[0]?.count ?? 0} tentative(s)</p>
                </div>
                <button type="button" onClick={() => navigate(`/admin/exams/${e.id}/results`)} className="btn-secondary text-xs">
                  Entrées / corriger →
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Journal des corrections */}
      <section className="card">
        <h2 className="title-display text-lg mb-3">Corrections ({corrections.length})</h2>
        {corrections.length === 0 ? <p className="text-muted text-sm italic">Aucune correction.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Correcteur</th><th className="py-2 pr-3">Détail</th>
            </tr></thead>
            <tbody className="divide-y divide-accent/10">
              {corrections.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3 text-muted whitespace-nowrap">{formatDate(l.created_at)}</td>
                  <td className="py-2 pr-3 text-white">{l.actor_id ? (actors[l.actor_id] || l.actor_id) : '—'}</td>
                  <td className="py-2 pr-3 text-muted text-xs">{l.meta ? JSON.stringify(l.meta) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Activité récente (toutes actions) */}
      <section className="card">
        <h2 className="title-display text-lg mb-3">Activité récente</h2>
        {logs.length === 0 ? <p className="text-muted text-sm italic">Aucune activité.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-accent uppercase tracking-widest text-[10px] border-b border-accent/20">
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Acteur</th><th className="py-2 pr-3">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-accent/10">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3 text-muted whitespace-nowrap">{formatDate(l.created_at)}</td>
                  <td className="py-2 pr-3 text-white">{l.actor_id ? (actors[l.actor_id] || l.actor_id) : 'Élève'}</td>
                  <td className="py-2 pr-3">{ACTION_LABELS[l.action] || l.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
