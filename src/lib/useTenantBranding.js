import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Branding du tenant déduit du sous-domaine (host). null tant que non résolu / inconnu.
export function useTenantBranding() {
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    let active = true;
    const host = window.location.hostname;
    supabase
      .rpc('tenant_branding_by_host', { p_host: host })
      .then(({ data }) => {
        if (active && Array.isArray(data) && data[0]) setBranding(data[0]);
      });
    return () => { active = false; };
  }, []);

  return branding;
}
