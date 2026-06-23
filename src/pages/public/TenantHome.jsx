import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import ExamBrand from '../../components/ExamBrand.jsx';

const HOST = window.location.hostname;

// Accueil public par domaine: vitrine des matières du tenant.
export default function TenantHome() {
  const [matieres, setMatieres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('matieres_by_host', { p_host: HOST }).then(({ data }) => {
      setMatieres(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <ExamBrand />
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-10">Matières disponibles</p>

      {loading ? (
        <p className="text-muted text-center">Chargement…</p>
      ) : matieres.length === 0 ? (
        <p className="text-muted italic text-center">Aucune matière publiée pour le moment.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {matieres.map((m) => (
            <li key={m.id}>
              <Link to={`/m/${m.slug}`} className="card block hover:border-accent/50 transition group h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-display text-white group-hover:text-accent transition uppercase text-sm tracking-wider">{m.name}</div>
                  {m.has_password && <span className="text-accent/70 text-xs shrink-0" title="Accès protégé">🔒</span>}
                </div>
                {m.description && <p className="text-xs text-muted leading-relaxed mb-3">{m.description}</p>}
                <div className="text-[10px] text-muted uppercase tracking-widest flex gap-3">
                  {m.exam_count > 0 && <span>{m.exam_count} examen(s)</span>}
                  {m.course_count > 0 && <span>{m.course_count} cours révision</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
