import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

const lsKey = (slug) => `examCandidate:${slug}`;

export default function ExamInstructions() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(lsKey(slug));
    if (!raw) {
      navigate(`/exam/${slug}`, { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('exams')
        .select('title, instructions, question_ids, is_open')
        .eq('slug', slug)
        .maybeSingle();
      setExam(data);
      setLoading(false);
    })();
  }, [slug, navigate]);

  if (loading) return <p className="text-muted p-10 text-center">Chargement…</p>;
  if (!exam) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-incorrect">Examen introuvable.</p>
      </div>
    );
  }

  const nbQuestions = Array.isArray(exam.question_ids) ? exam.question_ids.length : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="title-display text-2xl mb-2 text-center">{exam.title}</h1>
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">Instructions</p>

      <div className="card space-y-4">
        <p className="text-sm text-white/80">
          Cet examen comporte <span className="text-accent font-bold">{nbQuestions} questions</span>.
        </p>
        {exam.instructions ? (
          <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{exam.instructions}</p>
        ) : (
          <p className="text-sm text-muted italic">Aucune instruction supplémentaire.</p>
        )}

        <ul className="text-xs text-muted space-y-1 pt-4 border-t border-accent/20">
          <li>• Vous ne pourrez pas revenir aux questions précédentes.</li>
          <li>• Une fois soumis, l'examen ne peut plus être modifié.</li>
          <li>• Vos résultats seront communiqués par l'administrateur.</li>
        </ul>

        <div className="pt-4 flex justify-end gap-3">
          <Link to="/" className="btn-secondary">Annuler</Link>
          <Link to={`/exam/${slug}/run`} className="btn-primary">Commencer l'examen</Link>
        </div>
      </div>
    </div>
  );
}
