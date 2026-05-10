import React, { useCallback, useState } from 'react';
import data from './data/questions.json';
import { selectQuestions } from './utils/quizUtils.js';
import Accueil from './components/Accueil.jsx';
import SelectionCours from './components/SelectionCours.jsx';
import QuizSession from './components/QuizSession.jsx';
import ResultatsFinaux from './components/ResultatsFinaux.jsx';

export default function App() {
  const [phase, setPhase] = useState('accueil');
  const [mode, setMode] = useState(null);
  const [coursSelectionne, setCoursSelectionne] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [indexQuestion, setIndexQuestion] = useState(0);
  const [reponses, setReponses] = useState([]);
  const [reponseEnCours, setReponseEnCours] = useState(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const demarrerQuiz = useCallback(
    (m, coursId = null) => {
      const qs = selectQuestions(data, m, coursId);
      if (qs.length === 0) return;
      setMode(m);
      setCoursSelectionne(coursId);
      setQuestions(qs);
      setIndexQuestion(0);
      setReponses([]);
      setReponseEnCours(null);
      setFeedbackVisible(false);
      setPhase('quiz');
    },
    []
  );

  const choisirComplet = () => demarrerQuiz('complet');
  const choisirCours = () => setPhase('selection_cours');
  const choisirCoursId = (id) => demarrerQuiz('cours', id);

  const valider = () => {
    if (reponseEnCours === null || feedbackVisible) return;
    const q = questions[indexQuestion];
    const estCorrecte = reponseEnCours === q.reponseCorrecte;
    setReponses((prev) => {
      const next = prev.slice();
      next[indexQuestion] = {
        questionId: q.id,
        reponseChoisie: reponseEnCours,
        estCorrecte
      };
      return next;
    });
    setFeedbackVisible(true);
  };

  const suivant = () => {
    if (indexQuestion + 1 >= questions.length) {
      setPhase('resultats');
      return;
    }
    setIndexQuestion((i) => i + 1);
    setReponseEnCours(null);
    setFeedbackVisible(false);
  };

  const rejouer = () => {
    demarrerQuiz(mode, coursSelectionne);
  };

  const retourAccueil = () => {
    setPhase('accueil');
    setMode(null);
    setCoursSelectionne(null);
    setQuestions([]);
    setIndexQuestion(0);
    setReponses([]);
    setReponseEnCours(null);
    setFeedbackVisible(false);
  };

  return (
    <div className="min-h-screen bg-bg">
      {phase === 'accueil' && (
        <Accueil
          meta={data.meta}
          onChoisirComplet={choisirComplet}
          onChoisirCours={choisirCours}
          coursDisponibles={data.cours.filter((c) => c.questions.length > 0)}
          onChoisirCoursDirect={choisirCoursId}
        />
      )}

      {phase === 'selection_cours' && (
        <SelectionCours
          cours={data.cours}
          onSelect={choisirCoursId}
          onRetour={() => setPhase('accueil')}
        />
      )}

      {phase === 'quiz' && (
        <QuizSession
          questions={questions}
          index={indexQuestion}
          reponses={reponses}
          reponseEnCours={reponseEnCours}
          feedbackVisible={feedbackVisible}
          onChoisir={(i) => !feedbackVisible && setReponseEnCours(i)}
          onValider={valider}
          onSuivant={suivant}
          onQuitter={retourAccueil}
        />
      )}

      {phase === 'resultats' && (
        <ResultatsFinaux
          questions={questions}
          reponses={reponses}
          onRejouer={rejouer}
          onAccueil={retourAccueil}
        />
      )}

      <footer className="text-center py-10 opacity-40">
        <div className="w-8 h-[1px] bg-accent/30 mx-auto mb-4" />
        <p className="text-[10px] text-accent uppercase tracking-[0.4em]">
          Al-Qawā'id Al-Muthlaa • Révision
        </p>
      </footer>
    </div>
  );
}
