import React from 'react';
import { useTenantBranding } from '../lib/useTenantBranding.js';

// Entête de marque par sous-domaine sur les pages candidat. Ne rend rien si host inconnu.
export default function ExamBrand() {
  const branding = useTenantBranding();
  if (!branding) return null;
  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      {branding.logo_url && (
        <img src={branding.logo_url} alt={branding.name} className="h-12 w-auto object-contain" />
      )}
      <p className="text-[10px] text-accent uppercase tracking-[0.4em]">{branding.name}</p>
    </div>
  );
}
