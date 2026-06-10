import React from 'react';

// Rendu de champs dynamiques pilotés par un schéma jsonb, intégré à un useForm parent.
// schema: [{ key, label, type, required, options? }]
//   type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox'
// register/errors: issus de react-hook-form du parent.
// Les noms de champs sont préfixés (défaut "f_") pour éviter les collisions avec
// les champs cœur (full_name/email/telegram/access_code).
export const FIELD_PREFIX = 'f_';

export function extractFormData(values, schema, prefix = FIELD_PREFIX) {
  const out = {};
  for (const field of schema || []) {
    out[field.key] = values[`${prefix}${field.key}`] ?? null;
  }
  return out;
}

export default function DynamicForm({ schema = [], register, errors = {}, prefix = FIELD_PREFIX }) {
  const inputCls = 'w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none';

  return (
    <>
      {schema.map((field) => {
        const name = `${prefix}${field.key}`;
        const rules = field.required ? { required: `${field.label} requis` } : {};
        const err = errors[name];
        return (
          <div key={field.key}>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">
              {field.label}{field.required && <span className="text-incorrect"> *</span>}
            </label>

            {field.type === 'textarea' && (
              <textarea rows={4} {...register(name, rules)} className={inputCls} />
            )}

            {field.type === 'select' && (
              <select {...register(name, rules)} className={inputCls} defaultValue="">
                <option value="" disabled>—</option>
                {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {field.type === 'radio' && (
              <div className="space-y-1">
                {(field.options || []).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm text-white/80">
                    <input type="radio" value={o} {...register(name, rules)} className="accent-accent" />
                    {o}
                  </label>
                ))}
              </div>
            )}

            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input type="checkbox" {...register(name, rules)} className="w-4 h-4 accent-accent" />
                {field.label}
              </label>
            )}

            {(!field.type || ['text', 'email', 'tel'].includes(field.type)) && (
              <input type={field.type || 'text'} {...register(name, rules)} className={inputCls} />
            )}

            {err && <p className="text-incorrect text-xs mt-1">{err.message || 'Champ requis'}</p>}
          </div>
        );
      })}
    </>
  );
}
