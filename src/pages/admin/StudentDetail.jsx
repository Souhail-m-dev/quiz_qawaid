import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import ProgressionMatieres from '../../components/ProgressionMatieres.jsx';

const STATUS_LABELS = { pending: 'En attente', approved: 'Validé', rejected: 'Refusé' };

// Fiche élève: statut, matières, progression cours par cours.
export default function StudentDetail() {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: list, error: lErr }, { data: prog, error: pErr }] = await Promise.all([
        supabase.rpc('list_students'),
        supabase.rpc('student_progress', { p_student_id: studentId })
      ]);
      if (lErr || pErr) setError((lErr || pErr).message);
      setStudent((list || []).find((s) => s.id === studentId) || null);
      setRows(prog || []);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="title-display text-2xl">{student?.full_name || student?.email || 'Élève'}</h1>
          <p className="text-[10px] text-muted uppercase tracking-widest mt-1">
            {student?.email}
            {student && <span className="text-accent"> · {STATUS_LABELS[student.status] || student.status}</span>}
            {student?.class_name && <span> · classe {student.class_name}</span>}
          </p>
        </div>
        <Link to="/admin/eleves" className="btn-secondary">← Élèves</Link>
      </div>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      <ProgressionMatieres
        rows={rows}
        emptyLabel="Aucune matière attribuée à cet élève."
      />
    </div>
  );
}
