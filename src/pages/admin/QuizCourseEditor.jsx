import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import MatiereSelect from '../../components/MatiereSelect.jsx';

const DIFFS = ['facile', 'moyenne', 'difficile'];
const emptyQuestion = () => ({ question: '', options: ['', '', '', ''], correct_index: 0, difficulte: 'moyenne', justification: '' });

export default function QuizCourseEditor() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(emptyQuestion());
  const [editingId, setEditingId] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: c, error: ce } = await supabase
      .from('quiz_courses').select('id, subject, number, title, course_date, tenant_id').eq('id', courseId).maybeSingle();
    if (ce || !c) { setError(ce?.message || 'Cours introuvable.'); setLoading(false); return; }
    setCourse(c);
    const { data: qs } = await supabase
      .from('quiz_questions').select('id, question, options, correct_index, difficulte, justification, position')
      .eq('course_id', courseId).order('position');
    setQuestions(qs || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [courseId]);

  const saveMeta = async () => {
    setSavingMeta(true);
    const { error: e } = await supabase.from('quiz_courses').update({
      subject: course.subject.trim(),
      number: course.number === '' || course.number == null ? null : Number.parseInt(course.number, 10),
      title: course.title.trim(),
      course_date: course.course_date?.trim() || null
    }).eq('id', courseId);
    setSavingMeta(false);
    if (e) setError(e.message);
  };

  const resetDraft = () => { setDraft(emptyQuestion()); setEditingId(null); };

  const submitQuestion = async (e) => {
    e.preventDefault();
    const opts = draft.options.map((o) => o.trim()).filter((o) => o !== '');
    if (!draft.question.trim() || opts.length < 2) { setError('Question + au moins 2 options requises.'); return; }
    if (draft.correct_index >= opts.length) { setError('La bonne réponse pointe une option vide.'); return; }
    setError(null);
    const payload = {
      course_id: courseId,
      question: draft.question.trim(),
      options: opts,
      correct_index: draft.correct_index,
      difficulte: draft.difficulte,
      justification: draft.justification.trim() || null
    };
    if (editingId) {
      const { error: er } = await supabase.from('quiz_questions').update(payload).eq('id', editingId);
      if (er) { setError(er.message); return; }
    } else {
      payload.position = questions.length;
      const { error: er } = await supabase.from('quiz_questions').insert(payload);
      if (er) { setError(er.message); return; }
    }
    resetDraft();
    load();
  };

  const editQuestion = (q) => {
    setEditingId(q.id);
    const opts = Array.isArray(q.options) ? q.options.slice() : [];
    while (opts.length < 4) opts.push('');
    setDraft({ question: q.question, options: opts, correct_index: q.correct_index, difficulte: q.difficulte, justification: q.justification || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('Supprimer cette question ?')) return;
    const { error: e } = await supabase.from('quiz_questions').delete().eq('id', id);
    if (e) { setError(e.message); return; }
    load();
  };

  const deleteCourse = async () => {
    if (!window.confirm('Supprimer ce cours et toutes ses questions ?')) return;
    const { error: e } = await supabase.from('quiz_courses').delete().eq('id', courseId);
    if (e) { setError(e.message); return; }
    navigate('/admin/quiz');
  };

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (!course) return <p className="text-incorrect p-10">{error || 'Cours introuvable.'}</p>;

  const setOpt = (i, v) => setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <Link to="/admin/quiz" className="btn-secondary">← Banque</Link>
        <button type="button" onClick={deleteCourse} className="btn-secondary text-incorrect border-incorrect/40 hover:bg-incorrect/10">Supprimer le cours</button>
      </div>

      <div className="card mb-6 grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Matière</label>
          <MatiereSelect value={course.subject} onChange={(v) => setCourse((c) => ({ ...c, subject: v }))}
            tenantId={course.tenant_id}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">N° d'unité</label>
          <input type="number" value={course.number ?? ''} onChange={(e) => setCourse((c) => ({ ...c, number: e.target.value }))}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Date</label>
          <input value={course.course_date ?? ''} onChange={(e) => setCourse((c) => ({ ...c, course_date: e.target.value }))}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Titre</label>
          <input value={course.title} onChange={(e) => setCourse((c) => ({ ...c, title: e.target.value }))}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        </div>
        <div className="sm:col-span-2">
          <button type="button" onClick={saveMeta} disabled={savingMeta} className="btn-secondary">{savingMeta ? 'Enregistrement…' : 'Enregistrer le cours'}</button>
        </div>
      </div>

      <form onSubmit={submitQuestion} className="card mb-6 space-y-3">
        <h2 className="title-display text-sm tracking-[0.2em]">{editingId ? 'Modifier la question' : 'Nouvelle question'}</h2>
        <textarea value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
          rows={2} placeholder="Énoncé de la question"
          className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        <div className="space-y-2">
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={draft.correct_index === i} onChange={() => setDraft((d) => ({ ...d, correct_index: i }))}
                title="Bonne réponse" className="accent-correct" />
              <input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`}
                className="flex-1 bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
            </div>
          ))}
          <p className="text-[10px] text-muted">Le bouton radio = bonne réponse. Options vides ignorées.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={draft.difficulte} onChange={(e) => setDraft((d) => ({ ...d, difficulte: e.target.value }))}
            className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none">
            {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <textarea value={draft.justification} onChange={(e) => setDraft((d) => ({ ...d, justification: e.target.value }))}
          rows={2} placeholder="Justification (affichée en feedback)"
          className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none" />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">{editingId ? 'Mettre à jour' : 'Ajouter la question'}</button>
          {editingId && <button type="button" onClick={resetDraft} className="btn-secondary">Annuler</button>}
        </div>
      </form>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      <h2 className="title-display text-sm tracking-[0.2em] mb-3">Questions ({questions.length})</h2>
      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={q.id} className="card flex items-start gap-3">
            <span className="text-[10px] text-accent font-bold mt-1 w-6">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{q.question}</p>
              <p className="text-[11px] text-correct mt-1">✓ {q.options?.[q.correct_index]}</p>
              <span className="text-[9px] uppercase tracking-widest text-muted">{q.difficulte}</span>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button type="button" onClick={() => editQuestion(q)} className="text-xs text-accent hover:text-white">Éditer</button>
              <button type="button" onClick={() => deleteQuestion(q.id)} className="text-xs text-incorrect hover:text-white">Suppr.</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
