import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { dateStyle: 'short' });
}

const profileLabel = (p) => p?.full_name || p?.email || p?.username || p?.id || '—';

export default function Tenants() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [{ data: tenants, error: te }, { data: profiles }, { data: exams }, { data: candidates }] =
        await Promise.all([
          supabase.from('tenants').select('id, name, owner_id, created_at').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*'),
          supabase.from('exams').select('id, tenant_id'),
          supabase.from('candidates').select('id, tenant_id')
        ]);
      if (te) { setError(te.message); setLoading(false); return; }

      const profById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      const examCount = {};
      (exams || []).forEach((e) => { examCount[e.tenant_id] = (examCount[e.tenant_id] || 0) + 1; });
      const candCount = {};
      (candidates || []).forEach((c) => { candCount[c.tenant_id] = (candCount[c.tenant_id] || 0) + 1; });
      const staffCount = {};
      (profiles || []).forEach((p) => { if (p.tenant_id) staffCount[p.tenant_id] = (staffCount[p.tenant_id] || 0) + 1; });

      setRows((tenants || []).map((t) => ({
        ...t,
        owner: profById[t.owner_id],
        exams: examCount[t.id] || 0,
        candidates: candCount[t.id] || 0,
        staff: staffCount[t.id] || 0
      })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (error) return <p className="text-incorrect p-10">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="title-display text-2xl">Instances (tenants)</h1>
        <div className="flex gap-3">
          <Link to="/admin/users" className="btn-secondary">Utilisateurs</Link>
          <Link to="/admin/activity" className="btn-secondary">Activité</Link>
          <Link to="/admin" className="btn-secondary">← Tableau de bord</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted italic">Aucune instance.</p>
      ) : (
        <div className="grid gap-4">
          {rows.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/admin/tenants/${t.id}`)}
              className="card flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-accent/5"
            >
              <div>
                <h2 className="title-display text-lg mb-1">{t.name}</h2>
                <p className="text-xs text-muted">
                  Owner: <span className="text-white/80">{profileLabel(t.owner)}</span> · créé le {formatDate(t.created_at)}
                </p>
                <p className="text-xs text-muted mt-1">
                  {t.exams} examen(s) · {t.candidates} inscrit(s) · {t.staff} membre(s)
                </p>
              </div>
              <span className="text-accent text-sm">Ouvrir →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
