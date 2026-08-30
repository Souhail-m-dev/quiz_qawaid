import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';

// Classes: un groupe d'élèves, porteur d'un ensemble de matières.
// Chaîne: classe → matières → cours → examen/quizz.
export default function ClassesAdmin() {
  const { isPlatformAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [rows, setRows] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [counts, setCounts] = useState({}); // class_id -> nb d'élèves
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!isPlatformAdmin) return;
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      if (data) { setTenants(data); if (data[0]) setTenantId((t) => t || data[0].id); }
    });
  }, [isPlatformAdmin]);

  const load = async () => {
    setLoading(true);
    let cq = supabase.from('classes').select('id, name, slug, description, position').order('position').order('name');
    let mq = supabase.from('matieres').select('id, name').order('position').order('name');
    if (isPlatformAdmin && tenantId) { cq = cq.eq('tenant_id', tenantId); mq = mq.eq('tenant_id', tenantId); }

    const [{ data: cls, error: e }, { data: mats }, { data: links }, { data: students }] = await Promise.all([
      cq, mq,
      supabase.from('class_matieres').select('class_id, matiere_id'),
      supabase.rpc('list_students')
    ]);
    if (e) { setError(e.message); setLoading(false); return; }

    const byClass = new Map();
    for (const l of links || []) {
      if (!byClass.has(l.class_id)) byClass.set(l.class_id, []);
      byClass.get(l.class_id).push(l.matiere_id);
    }
    setRows((cls || []).map((c) => ({ ...c, matiere_ids: byClass.get(c.id) || [], _desc: c.description || '' })));
    setMatieres(mats || []);
    setCounts((students || []).reduce((acc, s) => {
      if (s.class_id) acc[s.class_id] = (acc[s.class_id] || 0) + 1;
      return acc;
    }, {}));
    setLoading(false);
  };

  useEffect(() => {
    if (isPlatformAdmin && !tenantId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isPlatformAdmin]);

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const payload = { name: newName.trim(), created_by: userData.user?.id };
    if (isPlatformAdmin && tenantId) payload.tenant_id = tenantId;
    const { error: er } = await supabase.from('classes').insert(payload);
    if (er) { setError(er.message); return; }
    setNewName('');
    load();
  };

  const saveDesc = async (r) => {
    setError(null);
    const { error: er } = await supabase.from('classes')
      .update({ description: r._desc.trim() === '' ? null : r._desc.trim() })
      .eq('id', r.id);
    if (er) { setError(er.message); return; }
    load();
  };

  const remove = async (r) => {
    if (!window.confirm(`Supprimer la classe « ${r.name} » ? Les élèves qui y sont rattachés perdront leurs matières de classe.`)) return;
    setError(null);
    const { error: er } = await supabase.from('classes').delete().eq('id', r.id);
    if (er) { setError(er.message); return; }
    load();
  };

  const toggleMatiere = async (r, matiereId) => {
    setError(null);
    const on = r.matiere_ids.includes(matiereId);
    const { error: er } = on
      ? await supabase.from('class_matieres').delete().eq('class_id', r.id).eq('matiere_id', matiereId)
      : await supabase.from('class_matieres').insert({ class_id: r.id, matiere_id: matiereId });
    if (er) { setError(er.message); return; }
    setRows((rs) => rs.map((x) => (x.id === r.id
      ? { ...x, matiere_ids: on ? x.matiere_ids.filter((id) => id !== matiereId) : [...x.matiere_ids, matiereId] }
      : x)));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="title-display text-2xl">Classes</h1>
        <div className="flex gap-2 items-center flex-wrap">
          {isPlatformAdmin && (
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
              className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none">
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Link to="/admin/eleves" className="btn-secondary">Élèves →</Link>
        </div>
      </div>

      <p className="text-xs text-muted mb-4">
        Une classe regroupe des matières. L'élève rattaché à une classe accède aux cours et examens
        de toutes ses matières. Des matières peuvent aussi être ajoutées individuellement depuis la
        page Élèves : les deux se cumulent.
      </p>

      <form onSubmit={create} className="card mb-6 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Créer une classe</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Niveau 1 — 2026"
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        </div>
        <button type="submit" className="btn-secondary">Ajouter</button>
      </form>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted italic">Aucune classe.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-white text-sm">{r.name}</span>
                  <span className="text-[10px] text-muted ml-2">{counts[r.id] || 0} élève(s)</span>
                </div>
                <button type="button" onClick={() => remove(r)} className="text-xs text-incorrect/70 hover:text-incorrect">Supprimer</button>
              </div>

              <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Matières de la classe</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {matieres.length === 0 ? (
                  <span className="text-[10px] text-muted">Aucune matière dans l'instance.</span>
                ) : matieres.map((m) => {
                  const on = r.matiere_ids.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMatiere(r, m.id)}
                      className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded border transition ${
                        on ? 'border-accent/50 bg-accent/15 text-accent' : 'border-accent/20 text-muted hover:text-white'
                      }`}
                    >
                      {on ? '✓ ' : ''}{m.name}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Description</label>
                  <input value={r._desc} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, _desc: e.target.value } : x)))}
                    className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
                </div>
                <button type="button" onClick={() => saveDesc(r)} className="btn-secondary">Enregistrer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
