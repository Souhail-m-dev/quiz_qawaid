import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import ExamBrand from '../../components/ExamBrand.jsx';
import ProgressionMatieres from '../../components/ProgressionMatieres.jsx';

// Tableau de bord élève: ses matières, ses cours, l'état de chaque examen.
export default function StudentDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: meData, error: meErr }, { data: prog, error: pErr }] = await Promise.all([
        supabase.rpc('student_me'),
        supabase.rpc('student_progress')
      ]);
      if (meErr || pErr) setError((meErr || pErr).message);
      setMe(meData || null);
      setRows(prog || []);
      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/eleve/login', { replace: true });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <ExamBrand />

      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-8">
        <div>
          <h1 className="title-display text-xl">{me?.full_name || 'Mon parcours'}</h1>
          <p className="text-[10px] text-muted uppercase tracking-widest mt-1">
            {me?.email}
            {me?.class_name && <span className="text-accent"> · {me.class_name}</span>}
          </p>
        </div>
        <button onClick={logout} className="text-xs text-muted hover:text-incorrect transition underline">
          Déconnexion
        </button>
      </div>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted text-center">Chargement…</p>
      ) : (
        <ProgressionMatieres
          rows={rows}
          canTake
          emptyLabel="Aucune matière ne vous a encore été attribuée. Contactez votre responsable."
        />
      )}
    </div>
  );
}
