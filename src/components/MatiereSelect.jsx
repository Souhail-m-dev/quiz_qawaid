import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const NEW = '__new__';

// Sélecteur de matière : liste les matières existantes du tenant pour éviter les
// doublons par faute de frappe (le trigger find-or-create crée une matière par
// libellé distinct). La création d'une nouvelle matière reste possible mais
// devient un choix explicite.
export default function MatiereSelect({ value, onChange, tenantId, allowEmpty = false, className = '' }) {
  const [names, setNames] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let query = supabase.from('matieres').select('name').order('name');
    if (tenantId) query = query.eq('tenant_id', tenantId);
    query.then(({ data }) => {
      setNames([...new Set((data || []).map((m) => m.name))]);
    });
  }, [tenantId]);

  // Valeur inconnue de la liste (nouvelle matière en cours de saisie) → mode texte.
  if (creating || (value !== '' && !names.includes(value))) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus={creating}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nom de la nouvelle matière"
          className={className}
        />
        <button
          type="button"
          onClick={() => { setCreating(false); onChange(''); }}
          className="btn-secondary text-xs shrink-0"
        >
          Liste
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW) { setCreating(true); onChange(''); }
        else onChange(e.target.value);
      }}
      className={className}
    >
      <option value="">{allowEmpty ? '— Aucune —' : '— Choisir une matière —'}</option>
      {names.map((n) => <option key={n} value={n}>{n}</option>)}
      <option value={NEW}>➕ Nouvelle matière…</option>
    </select>
  );
}
