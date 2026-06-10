import React from 'react';
import { IconUp, IconDown, IconClose, IconPlus } from './icons.jsx';

const TYPES = [
  ['text', 'Texte'],
  ['email', 'Email'],
  ['tel', 'Téléphone'],
  ['textarea', 'Texte long'],
  ['select', 'Liste déroulante'],
  ['radio', 'Choix unique'],
  ['checkbox', 'Case à cocher']
];

const slugKey = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || `champ_${Math.random().toString(36).slice(2, 6)}`;

const hasOptions = (t) => t === 'select' || t === 'radio';

// value = tableau de champs (ou null). onChange(nextArray|null).
export default function FormSchemaBuilder({ value, onChange, label }) {
  const fields = value || [];
  const set = (next) => onChange(next.length ? next : null);

  const add = () => set([...fields, { key: slugKey('champ'), label: 'Nouveau champ', type: 'text', required: false }]);
  const update = (idx, patch) => set(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const remove = (idx) => set(fields.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = fields.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    set(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="title-display text-sm tracking-[0.3em]">{label} ({fields.length})</h3>
        <button type="button" onClick={add} className="add-tile"><IconPlus />Champ</button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted text-xs italic">Aucun champ supplémentaire (formulaire standard).</p>
      ) : (
        <ol className="space-y-2">
          {fields.map((f, idx) => (
            <li key={idx} className="border border-accent/20 rounded p-2 bg-bg/30 space-y-2">
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Libellé</label>
                  <input
                    value={f.label}
                    onChange={(e) => update(idx, { label: e.target.value, key: f.key || slugKey(e.target.value) })}
                    className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Type</label>
                  <select value={f.type} onChange={(e) => update(idx, { type: e.target.value })}
                    className="bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm">
                    {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-1 text-xs text-white/80 pb-1">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => update(idx, { required: e.target.checked })} className="accent-accent" />
                  Requis
                </label>
                <div className="flex gap-1 pb-0.5">
                  <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} className="icon-btn w-7 h-7" title="Monter"><IconUp /></button>
                  <button type="button" disabled={idx === fields.length - 1} onClick={() => move(idx, 1)} className="icon-btn w-7 h-7" title="Descendre"><IconDown /></button>
                  <button type="button" onClick={() => remove(idx)} className="icon-btn icon-btn-danger w-7 h-7" title="Supprimer"><IconClose /></button>
                </div>
              </div>
              {hasOptions(f.type) && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Options (une par ligne)</label>
                  <textarea
                    value={(f.options || []).join('\n')}
                    onChange={(e) => update(idx, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                    rows={3}
                    className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
