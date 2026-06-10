import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.js';

// Garde de route par rôle. roles = ['owner'] ou ['owner','correcteur'].
export default function RequireRole({ roles, children }) {
  const { session, role, isPlatformAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted text-sm tracking-widest uppercase">Chargement…</p>
      </div>
    );
  }
  // L'admin plateforme passe toutes les gardes staff/admin (tier du haut),
  // indépendamment de son rôle/tenant.
  if (!session || (!isPlatformAdmin && !roles.includes(role))) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function RequireAdmin({ children }) {
  return <RequireRole roles={['owner']}>{children}</RequireRole>;
}

export function RequireStaff({ children }) {
  return <RequireRole roles={['owner', 'correcteur']}>{children}</RequireRole>;
}

// Réservé à l'admin plateforme (flag is_platform_admin), pas un rôle.
export function RequirePlatformAdmin({ children }) {
  const { session, isPlatformAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted text-sm tracking-widest uppercase">Chargement…</p>
      </div>
    );
  }
  if (!session || !isPlatformAdmin) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }
  return children;
}
