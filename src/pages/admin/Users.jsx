import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth, roleLabel } from '../../lib/useAuth.js';

export default function Users() {
  const { isPlatformAdmin, session } = useAuth();
  const myId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [tenants, setTenants] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteTenants, setInviteTenants] = useState([]);
  const [inviteTenantId, setInviteTenantId] = useState('');

  // Owner réservé à l'admin plateforme (créé via provision_owner avec un tenant).
  // 'editeur' (« Admin ») et 'correcteur' attribuables par l'owner.
  const roleOptions = isPlatformAdmin ? ['owner', 'editeur', 'correcteur'] : ['editeur', 'correcteur'];

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
    // Instances vers lesquelles on peut inviter (owner: les siennes; plateforme: toutes).
    const { data: it } = await supabase.rpc('invite_tenants');
    const list = it || [];
    setInviteTenants(list);
    setInviteTenantId((prev) => prev || (list.length ? list[0].id : ''));
    setLoading(false);
  };

  useEffect(() => { load(); }, [isPlatformAdmin]);

  const inviteCorrector = async () => {
    const email = window.prompt("Email du correcteur à inviter (doit déjà avoir un compte Supabase Auth) :");
    if (!email) return;
    setError(null);
    setInviting(true);
    try {
      const { error: e } = await supabase.rpc('invite_corrector', { p_email: email.trim() });
      if (e) setError(e.message);
      else await load();
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); setLinkCopied(true); } catch { /* noop */ }
  };

  const generateInviteLink = async () => {
    setError(null);
    setLinkCopied(false);
    setInviteLink(null);
    setInviting(true);
    try {
      const email = window.prompt("Email du correcteur (optionnel, pour pré-remplir) :");
      const { data, error: e } = await supabase.rpc('create_invite', {
        p_email: email || null,
        p_tenant_id: inviteTenantId || null,
      });
      if (e) { setError(e.message); return; }
      setInviteLink(`${window.location.origin}/invite/${data}`);
    } finally {
      setInviting(false);
    }
  };

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
        <div className="flex gap-2 flex-wrap items-center">
          {inviteTenants.length > 1 && (
            <select
              value={inviteTenantId}
              onChange={(e) => setInviteTenantId(e.target.value)}
              title="Instance cible du lien d’invitation"
              className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white focus:border-accent outline-none"
            >
              {inviteTenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={inviting}
            onClick={generateInviteLink}
          >
            {inviting ? '…' : '+ Lien d’invitation'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={inviting}
            onClick={inviteCorrector}
            title="Pour un compte déjà existant dans Supabase Auth"
          >
            Inviter (compte existant)
          </button>
          <Link to="/admin" className="btn-secondary">← Retour</Link>
        </div>
      </div>

      {inviteLink && (
        <div className="card mb-4 border border-accent/40 bg-accent/5">
          <p className="text-sm text-white font-bold mb-1">Lien d’invitation prêt</p>
          <p className="text-xs text-muted mb-3">
            Envoyez ce lien au correcteur (WhatsApp, Telegram, email…). Il crée son compte et
            rejoint votre instance en correcteur. Valable 7 jours, usage unique.
          </p>
          <button
            type="button"
            onClick={copyLink}
            title="Cliquer pour copier"
            className="w-full text-left bg-bg/60 border border-accent/30 hover:border-accent rounded px-3 py-3 text-accent text-sm break-all cursor-pointer transition-colors"
          >
            {inviteLink}
          </button>
          <p className={`text-xs mt-2 ${linkCopied ? 'text-correct' : 'text-muted'}`}>
            {linkCopied ? '✓ Copié dans le presse-papiers' : 'Cliquez sur le lien pour le copier'}
          </p>
        </div>
      )}

      <p className="text-xs text-muted mb-4">
        « Lien d’invitation » génère un lien à envoyer vous-même : le correcteur crée son compte
        et apparaît ici automatiquement, en correcteur.{' '}
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
                    {/* L'owner ne modifie ni son propre rôle ni celui d'un autre owner;
                        seul l'admin plateforme le peut (via provision_owner / set_member_role). */}
                    {(!isPlatformAdmin && (r.id === myId || r.role === 'owner')) ? (
                      <span className="text-white">
                        {roleLabel(r.role)}
                        {r.id === myId && <span className="ml-2 text-[9px] uppercase text-muted">(vous)</span>}
                      </span>
                    ) : (
                      <select
                        value={r.role || 'correcteur'}
                        disabled={savingId === r.id}
                        onChange={(e) => changeRole(r.id, e.target.value)}
                        className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white focus:border-accent outline-none"
                      >
                        {(roleOptions.includes(r.role) ? roleOptions : [r.role, ...roleOptions].filter(Boolean))
                          .map((role) => (
                            <option key={role} value={role}>{roleLabel(role)}</option>
                          ))}
                      </select>
                    )}
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
