import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';

// Matières par tenant: créées auto depuis les subjects, éditables ici (mot de passe + description).
export default function MatieresAdmin() {
  const { isPlatformAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [rows, setRows] = useState([]);
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
    let query = supabase.from('matieres').select('id, name, slug, description, access_code, position').order('position').order('name');
    if (isPlatformAdmin && tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error: e } = await query;
    if (e) setError(e.message);
    else setRows((data || []).map((r) => ({ ...r, _code: r.access_code || '', _desc: r.description || '' })));
    setLoading(false);
  };

  useEffect(() => {
    if (isPlatformAdmin && !tenantId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isPlatformAdmin]);

  const setField = (id, key, val) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));

  const save = async (r) => {
    const { error: e } = await supabase.from('matieres').update({
      access_code: r._code.trim() === '' ? null : r._code.trim(),
      description: r._desc.trim() === '' ? null : r._desc.trim()
    }).eq('id', r.id);
    if (e) { setError(e.message); return; }
    load();
  };

  const remove = async (r) => {
    if (!window.confirm(`Supprimer la matière « ${r.name} » ? (les examens/cours liés ne sont pas supprimés, juste déliés)`)) return;
    const { error: e } = await supabase.from('matieres').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    load();
  };

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const payload = { name: newName.trim(), created_by: userData.user?.id };
    if (isPlatformAdmin && tenantId) payload.tenant_id = tenantId;
    const { error: er } = await supabase.from('matieres').insert(payload);
    if (er) { setError(er.message); return; }
    setNewName('');
    load();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="title-display text-2xl">Matières</h1>
        {isPlatformAdmin && (
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none">
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <p className="text-xs text-muted mb-4">
        Les matières se créent automatiquement quand tu saisis une « matière » sur un examen ou un cours de révision.
        Ici tu fixes le mot de passe d'accès (vide = public) et la description affichés sur la vitrine.
      </p>

      <form onSubmit={create} className="card mb-6 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Créer une matière</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la matière"
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        </div>
        <button type="submit" className="btn-secondary">Ajouter</button>
      </form>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted italic">Aucune matière.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-white text-sm">{r.name}</span>
                  <span className="text-[10px] text-muted ml-2">/m/{r.slug}</span>
                </div>
                <button type="button" onClick={() => remove(r)} className="text-xs text-incorrect/70 hover:text-incorrect">Supprimer</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Mot de passe (vide = public)</label>
                  <input value={r._code} onChange={(e) => setField(r.id, '_code', e.target.value)}
                    className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm font-mono focus:border-accent outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Description</label>
                  <input value={r._desc} onChange={(e) => setField(r.id, '_desc', e.target.value)}
                    className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
                </div>
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => save(r)} className="btn-secondary">Enregistrer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
