import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';

export default function Users() {
  const { isPlatformAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [tenants, setTenants] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Owner réservé à l'admin plateforme (créé via provision_owner avec un tenant).
  const roleOptions = isPlatformAdmin ? ['owner', 'admin', 'correcteur'] : ['admin', 'correcteur'];

  const load = async () => {
    const { data, error: e } = await supabase.rpc('list_members');
    if (e) {
      setError(e.message);
    } else {
      setRows(data || []);
    }
    if (isPlatformAdmin) {
      const { data: t } = await supabase.from('tenants').select('id, name');
      setTenants(Object.fromEntries((t || []).map((x) => [x.id, x.name])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [isPlatformAdmin]);

  const changeRole = async (id, role) => {
    setError(null);
    setSavingId(id);
    try {
      if (role === 'owner') {
        // Crée une instance dédiée + bascule le profil en owner.
        const name = window.prompt("Nom de l'instance (tenant) pour cet owner :");
        if (!name) { setSavingId(null); return; }
        const { error: e } = await supabase.rpc('provision_owner', { p_profile_id: id, p_tenant_name: name });
        if (e) { setError(e.message); setSavingId(null); return; }
        await load();
      } else {
        const { error: e } = await supabase.rpc('set_member_role', { p_profile_id: id, p_role: role });
        if (e) setError(e.message);
        else setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role } : r)));
      }
    } finally {
      setSavingId(null);
    }
  };

  const labelFor = (r) => r.full_name || r.email || r.username || r.id;

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="title-display text-2xl">Utilisateurs</h1>
        <Link to="/admin" className="btn-secondary">← Retour</Link>
      </div>

      <p className="text-xs text-muted mb-4">
        Les comptes se créent via l'invitation Supabase Auth (un profil apparaît ici à la
        première connexion).{' '}
        {isPlatformAdmin
          ? "Choisir « owner » crée une instance (tenant) dédiée et y rattache l'utilisateur."
          : "Vous gérez les rôles de votre instance."}
      </p>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-muted italic">Aucun profil.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-accent/20 text-accent uppercase tracking-widest text-[10px]">
                <th className="py-2 pr-3">Utilisateur</th>
                {isPlatformAdmin && <th className="py-2 pr-3">Instance</th>}
                <th className="py-2 pr-3">Rôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-white">
                    {labelFor(r)}
                    {r.is_platform_admin && <span className="ml-2 text-[9px] uppercase px-2 py-0.5 rounded bg-accent/20 text-accent">plateforme</span>}
                  </td>
                  {isPlatformAdmin && <td className="py-2 pr-3 text-muted">{tenants[r.tenant_id] || '—'}</td>}
                  <td className="py-2 pr-3">
                    <select
                      value={r.role || (r.is_admin ? 'admin' : 'correcteur')}
                      disabled={savingId === r.id}
                      onChange={(e) => changeRole(r.id, e.target.value)}
                      className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white focus:border-accent outline-none"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
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
