import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import data from '../../data/questions.json';
import { getAllQuestions } from '../../utils/quizUtils.js';
import { supabase } from '../../lib/supabase.js';
import OptionButton from '../../components/OptionButton.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';

const lsKey = (slug) => `examCandidate:${slug}`;

export default function ExamRun() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentChoice, setCurrentChoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(lsKey(slug));
    if (!raw) {
      navigate(`/exam/${slug}`, { replace: true });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localStorage.removeItem(lsKey(slug));
      navigate(`/exam/${slug}`, { replace: true });
      return;
    }
    setCandidateId(parsed.candidateId);

    (async () => {
      let { data: examData, error: ee } = await supabase
        .from('exams')
        .select('id, title, question_ids, questions_snapshot')
        .eq('slug', slug)
        .maybeSingle();
      if (ee && /questions_snapshot/i.test(ee.message || '')) {
        const fallback = await supabase
          .from('exams')
          .select('id, title, question_ids')
          .eq('slug', slug)
          .maybeSingle();
        examData = fallback.data ? { ...fallback.data, questions_snapshot: null } : null;
        ee = fallback.error;
      }
      if (ee || !examData) {
        setError('Examen introuvable.');
        setLoading(false);
        return;
      }
      setExam(examData);

      const { data: attempts, error: attemptErr } = await supabase
        .from('attempts')
        .select('id, submitted_at, started_at')
        .eq('candidate_id', parsed.candidateId)
        .eq('exam_id', examData.id)
        .order('started_at', { ascending: false })
        .limit(1);
      if (attemptErr) {
        setError(attemptErr.message);
        setLoading(false);
        return;
      }
      const attempt = Array.isArray(attempts) ? attempts[0] : null;

      if (attempt?.submitted_at) {
        navigate(`/exam/${slug}/done`, { replace: true });
        return;
      }
      if (attempt?.id) {
        setAttemptId(attempt.id);
      } else {
        setError("Tentative introuvable. Veuillez refaire l'inscription.");
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
  }, [slug, navigate]);

  const questions = useMemo(() => {
    if (!exam) return [];
    if (Array.isArray(exam.questions_snapshot) && exam.questions_snapshot.length > 0) {
      return exam.questions_snapshot;
    }
    const all = getAllQuestions(data);
    const byId = Object.fromEntries(all.map((q) => [q.id, q]));
    return (exam.question_ids || []).map((qid) => byId[qid]).filter(Boolean);
  }, [exam]);

  const total = questions.length;
  const isLast = idx + 1 >= total;
  const current = questions[idx];

  const handleNext = async () => {
    if (currentChoice === null) return;
    const estCorrecte = currentChoice === current.reponseCorrecte;
    const nextAnswers = [...answers, {
      questionId: current.id,
      reponseChoisie: currentChoice,
      estCorrecte
    }];
    setAnswers(nextAnswers);
    setCurrentChoice(null);

    if (!isLast) {
      setIdx(idx + 1);
      return;
    }

    // submit
    setSubmitting(true);
    const score = nextAnswers.filter((a) => a.estCorrecte).length;
    const { data: updatedAttempt, error: upErr } = await supabase
      .from('attempts')
      .update({
        answers: nextAnswers,
        score,
        total,
        submitted_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select('id')
      .maybeSingle();
    setSubmitting(false);
    if (upErr) {
      setError("Échec de l'enregistrement : " + upErr.message);
      return;
    }
    if (!updatedAttempt) {
      setError("Échec de l'enregistrement : tentative introuvable.");
      return;
    }
    navigate(`/exam/${slug}/done`, { replace: true });
  };

  if (loading) return <p className="text-muted p-10 text-center">Chargement…</p>;
  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-incorrect">{error}</p>
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-incorrect">Cet examen ne contient aucune question.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="title-display text-lg mb-3">{exam.title}</h1>
        <ProgressBar courant={idx + 1} total={total} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="card"
        >
          <div className="mb-6 flex items-center justify-between">
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">
              Question {idx + 1} / {total}
            </span>
          </div>

          <h2 className="title-display text-lg sm:text-xl normal-case tracking-normal leading-relaxed text-white mb-8">
            {current.question}
          </h2>

          <div className="grid gap-3 sm:gap-4" role="radiogroup">
            {current.options.map((opt, i) => (
              <OptionButton
                key={i}
                index={i}
                texte={opt}
                selectionne={currentChoice === i}
                valide={false}
                estCorrecte={false}
                estChoisie={false}
                onClick={() => setCurrentChoice(i)}
              />
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              disabled={currentChoice === null || submitting}
              onClick={handleNext}
              className="btn-primary min-w-[160px]"
            >
              {submitting ? 'Envoi…' : isLast ? "Soumettre l'examen" : 'Question suivante'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
