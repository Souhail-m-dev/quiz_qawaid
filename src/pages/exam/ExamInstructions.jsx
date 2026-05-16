import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

const lsKey = (slug) => `examCandidate:${slug}`;
const draftKey = (slug) => `examRegistrationDraft:${slug}`;

export default function ExamInstructions() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const candidateRaw = localStorage.getItem(lsKey(slug));
    const draftRaw = localStorage.getItem(draftKey(slug));
    if (!candidateRaw && !draftRaw) {
      navigate(`/exam/${slug}`, { replace: true });
      return;
    }
    (async () => {
      let { data, error: err } = await supabase
        .from('exams')
        .select('id, title, instructions, question_ids, questions_snapshot, is_open')
        .eq('slug', slug)
        .maybeSingle();
      if (err && /questions_snapshot/i.test(err.message || '')) {
        const fallback = await supabase
          .from('exams')
          .select('id, title, instructions, question_ids, is_open')
          .eq('slug', slug)
          .maybeSingle();
        data = fallback.data ? { ...fallback.data, questions_snapshot: null } : null;
      }
      setExam(data);
      setLoading(false);
    })();
  }, [slug, navigate]);

  const handleStart = async () => {
    setError(null);
    const existing = localStorage.getItem(lsKey(slug));
    if (existing) {
      navigate(`/exam/${slug}/run`);
      return;
    }

    const rawDraft = localStorage.getItem(draftKey(slug));
    if (!rawDraft || !exam?.id) {
      setError('Informations d’inscription introuvables. Veuillez recommencer.');
      return;
    }

    let draft;
    try {
      draft = JSON.parse(rawDraft);
    } catch {
      localStorage.removeItem(draftKey(slug));
      setError('Données invalides. Veuillez refaire l’inscription.');
      return;
    }

    setStarting(true);
    const { data: registration, error: regErr } = await supabase.rpc('register_candidate_and_attempt', {
      p_exam_id: exam.id,
      p_slug: slug,
      p_access_code: draft.access_code || null,
      p_full_name: draft.full_name,
      p_email: draft.email,
      p_telegram: draft.telegram
    });
    setStarting(false);

    if (regErr) {
      if (regErr.code === '23505') {
        setError('Cet email a déjà été utilisé pour cet examen.');
      } else {
        setError(regErr.message);
      }
      return;
    }

    const candidateId = Array.isArray(registration) ? registration[0]?.candidate_id : registration?.candidate_id;
    if (!candidateId) {
      setError("Inscription échouée: identifiant candidat introuvable.");
      return;
    }

    localStorage.setItem(lsKey(slug), JSON.stringify({ candidateId, examId: exam.id }));
    localStorage.removeItem(draftKey(slug));
    navigate(`/exam/${slug}/run`);
  };

  if (loading) return <p className="text-muted p-10 text-center">Chargement…</p>;
  if (!exam) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-incorrect">Examen introuvable.</p>
      </div>
    );
  }

  const nbQuestions = Array.isArray(exam.questions_snapshot) && exam.questions_snapshot.length > 0
    ? exam.questions_snapshot.length
    : Array.isArray(exam.question_ids) ? exam.question_ids.length : 0;

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
        {error && <p className="text-incorrect text-sm">{error}</p>}

        <div className="pt-4 flex justify-end gap-3">
          <Link to="/" className="btn-secondary">Annuler</Link>
          <button type="button" onClick={handleStart} disabled={starting} className="btn-primary">
            {starting ? 'Initialisation…' : "Commencer l'examen"}
          </button>
        </div>
      </div>
    </div>
  );
}
