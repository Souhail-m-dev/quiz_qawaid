import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { selectQuestions, shuffle } from '../../utils/quizUtils.js';
import ExamBrand from '../../components/ExamBrand.jsx';
import QuizSession from '../../components/QuizSession.jsx';
import ResultatsFinaux from '../../components/ResultatsFinaux.jsx';

const HOST = window.location.hostname;

// Adapte les lignes RPC au modèle attendu par les composants de quiz.
const shapeQuestions = (rows) =>
  (rows || []).map((r) => ({
    id: r.id,
    question: r.question,
    options: r.options,
    reponseCorrecte: r.correct_index,
    difficulte: r.difficulte,
    justification: r.justification
  }));

export default function QuizRoute() {
  const [params] = useSearchParams();
  const presetSubject = params.get('subject');
  const [phase, setPhase] = useState('loading'); // loading|empty|matiere|accueil|quiz|resultats
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState(null);
  const [courses, setCourses] = useState([]);

  const [mode, setMode] = useState(null);
  const [coursId, setCoursId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState([]);
  const [reponseEnCours, setReponseEnCours] = useState(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const loadCourses = useCallback(async (subj) => {
    const { data } = await supabase.rpc('quiz_courses_by_host', { p_host: HOST, p_subject: subj });
    setCourses(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('quiz_subjects_by_host', { p_host: HOST });
      const subs = data || [];
      setSubjects(subs);
      if (presetSubject) {
        setSubject(presetSubject);
        await loadCourses(presetSubject);
        setPhase('accueil');
        return;
      }
      if (subs.length === 0) { setPhase('empty'); return; }
      if (subs.length === 1) {
        setSubject(subs[0].subject);
        await loadCourses(subs[0].subject);
        setPhase('accueil');
        return;
      }
      setPhase('matiere');
    })();
  }, [loadCourses, presetSubject]);

  const startQuiz = (qs, m, cId = null) => {
    if (!qs.length) return;
    setMode(m);
    setCoursId(cId);
    setQuestions(qs);
    setIndex(0);
    setReponses([]);
    setReponseEnCours(null);
    setFeedbackVisible(false);
    setPhase('quiz');
  };

  const demarrerCours = async (cId) => {
    const { data } = await supabase.rpc('quiz_questions_by_course', { p_course_id: cId });
    startQuiz(shuffle(shapeQuestions(data)), 'cours', cId);
  };

  const demarrerComplet = async () => {
    const all = [];
    for (const c of courses) {
      const { data } = await supabase.rpc('quiz_questions_by_course', { p_course_id: c.id });
      all.push(...shapeQuestions(data));
    }
    const data = { meta: { difficultyDistributionPerQuiz: { facile: 10, moyenne: 10, difficile: 10 } }, cours: [{ questions: all }] };
    startQuiz(selectQuestions(data, 'complet'), 'complet');
  };

  const valider = () => {
    if (reponseEnCours === null || feedbackVisible) return;
    const q = questions[index];
    const estCorrecte = reponseEnCours === q.reponseCorrecte;
    setReponses((prev) => {
      const next = prev.slice();
      next[index] = { questionId: q.id, reponseChoisie: reponseEnCours, estCorrecte };
      return next;
    });
    setFeedbackVisible(true);
  };

  const suivant = () => {
    if (index + 1 >= questions.length) { setPhase('resultats'); return; }
    setIndex((i) => i + 1);
    setReponseEnCours(null);
    setFeedbackVisible(false);
  };

  const rejouer = () => {
    if (mode === 'cours') demarrerCours(coursId);
    else demarrerComplet();
  };

  const retourAccueil = () => {
    setPhase('accueil');
    setQuestions([]);
    setIndex(0);
    setReponses([]);
    setReponseEnCours(null);
    setFeedbackVisible(false);
  };

  if (phase === 'loading') return <p className="text-muted p-10 text-center">Chargement…</p>;

  if (phase === 'empty') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ExamBrand />
        <h1 className="title-display text-xl mb-3">Révision</h1>
        <p className="text-muted">Aucun quiz de révision disponible pour le moment.</p>
      </div>
    );
  }

  if (phase === 'matiere') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <ExamBrand />
        <h1 className="title-display text-2xl mb-1 text-center">Révision</h1>
        <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">Choisissez une matière</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.subject}>
              <button
                type="button"
                onClick={async () => { setSubject(s.subject); await loadCourses(s.subject); setPhase('accueil'); }}
                className="w-full h-full text-left card hover:border-accent/50 transition group"
              >
                <div className="font-display text-white group-hover:text-accent transition uppercase text-sm tracking-wider">{s.subject}</div>
                <div className="text-[10px] text-muted mt-2 uppercase tracking-widest">{s.course_count} cours</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase === 'accueil') {
    const dispo = courses.filter((c) => c.question_count > 0);
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <ExamBrand />
        <h1 className="title-display text-2xl sm:text-3xl mb-1 text-center">{subject}</h1>
        <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">Mode révision</p>

        {subjects.length > 1 && (
          <button type="button" onClick={() => setPhase('matiere')} className="text-xs text-accent/80 hover:text-accent mb-6 inline-flex items-center gap-2">
            ← Autre matière
          </button>
        )}

        <button
          type="button"
          onClick={demarrerComplet}
          disabled={dispo.length === 0}
          className="card w-full text-left mb-6 hover:border-accent/60 transition group disabled:opacity-40"
        >
          <h2 className="title-display text-lg group-hover:text-white transition">Quiz complet</h2>
          <p className="text-sm text-muted mt-2">Questions tirées au sort sur l'ensemble des cours de la matière.</p>
        </button>

        <h2 className="title-display text-sm tracking-[0.3em] mb-3">Par cours</h2>
        {dispo.length === 0 ? (
          <p className="text-muted italic text-sm">Aucun cours avec des questions pour l'instant.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {dispo.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => demarrerCours(c.id)}
                  className="w-full h-full text-left card hover:border-accent/50 transition group"
                >
                  <div className="flex justify-between items-start mb-2">
                    {c.number != null && <span className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">Unité {c.number}</span>}
                    <span className="text-[9px] text-muted uppercase tracking-widest ml-auto">{c.question_count} questions</span>
                  </div>
                  <div className="font-display text-white group-hover:text-accent transition leading-snug uppercase text-sm tracking-wider">{c.title}</div>
                  {c.course_date && <div className="text-[10px] text-muted mt-2">{c.course_date}</div>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (phase === 'quiz') {
    return (
      <QuizSession
        questions={questions}
        index={index}
        reponses={reponses}
        reponseEnCours={reponseEnCours}
        feedbackVisible={feedbackVisible}
        onChoisir={(i) => !feedbackVisible && setReponseEnCours(i)}
        onValider={valider}
        onSuivant={suivant}
        onQuitter={retourAccueil}
      />
    );
  }

  return (
    <ResultatsFinaux
      questions={questions}
      reponses={reponses}
      onRejouer={rejouer}
      onAccueil={retourAccueil}
    />
  );
}
