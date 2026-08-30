import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Libellés affichés. 'editeur' est présenté « Admin » côté UI (cf. collision owner=admin).
export const ROLE_LABELS = { owner: 'Owner', editeur: 'Admin', correcteur: 'Correcteur', eleve: 'Élève' };
export const roleLabel = (r) => ROLE_LABELS[r] || r || '—';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile(s) {
      if (!s?.user) {
        if (active) {
          setRole(null);
          setTenantId(null);
          setIsPlatformAdmin(false);
          setStatus(null);
          setLoading(false);
        }
        return;
      }
      let { data, error } = await supabase
        .from('profiles')
        .select('role, is_admin, tenant_id, is_platform_admin, status')
        .eq('id', s.user.id)
        .maybeSingle();
      // Rétrocompat: colonnes récentes peut-être absentes -> retomber sur le minimum.
      if (error && /column .* does not exist/i.test(error.message || '')) {
        const fb = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', s.user.id)
          .maybeSingle();
        data = fb.data
          ? { role: fb.data.is_admin ? 'owner' : null, is_admin: fb.data.is_admin, tenant_id: null, is_platform_admin: fb.data.is_admin, status: 'approved' }
          : null;
        error = fb.error;
      }
      if (!active) return;
      let resolved = null;
      if (!error && data) {
        resolved = data.role || (data.is_admin ? 'owner' : null);
        setTenantId(data.tenant_id ?? null);
        setIsPlatformAdmin(data.is_platform_admin === true);
        setStatus(data.status ?? 'approved');
      }
      setRole(resolved);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Ne PAS repasser loading=true ici: le rafraîchissement de token au retour
      // d'onglet déclenche cet event; remettre loading=true démonterait les pages
      // gardées (RequireStaff) et "rechargerait" l'éditeur en cours. On met juste à
      // jour la session/profil silencieusement.
      setSession(s);
      loadProfile(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isTenantAdmin = role === 'owner';   // 'admin' intra-tenant supprimé
  const isEditor = role === 'editeur';       // libellé UI « Admin »
  return {
    session,
    role,
    tenantId,
    status,                                   // 'pending'|'approved'|'rejected' (validation élève)
    isPlatformAdmin,                          // = l'« admin » plateforme (tier du haut)
    isOwner: role === 'owner',
    isAdmin: isPlatformAdmin || isTenantAdmin, // gestion d'instance: plateforme OU owner
    isEditor,
    isContentManager: isPlatformAdmin || isTenantAdmin || isEditor, // crée/édite le contenu
    isCorrector: role === 'correcteur',
    isStaff: isPlatformAdmin || isTenantAdmin || isEditor || role === 'correcteur',
    isStudent: role === 'eleve',              // hors is_staff() par construction
    loading
  };
}
