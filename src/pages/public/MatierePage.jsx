import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import ExamBrand from '../../components/ExamBrand.jsx';

const HOST = window.location.hostname;
const unlockKey = (slug) => `matiereUnlock:${HOST}:${slug}`;

export default function MatierePage() {
  const { slug } = useParams();
  const [content, setContent] = useState(null);   // {locked, name, description, exams, courses}
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchContent = async (withCode) => {
    const { data, error: e } = await supabase.rpc('matiere_content', { p_host: HOST, p_slug: slug, p_code: withCode ?? null });
    if (e) { setError(e.message); return null; }
    if (data == null) { setNotFound(true); return null; }
    return data;
  };

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(unlockKey(slug));
      const data = await fetchContent(stored);
      if (data) setContent(data);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const submitCode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = await fetchContent(code.trim());
    setSubmitting(false);
    if (!data) return;
    if (data.locked) { setError('Mot de passe incorrect.'); return; }
    localStorage.setItem(unlockKey(slug), code.trim());
    setContent(data);
  };

  if (loading) return <p className="text-muted p-10 text-center">Chargement…</p>;
  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ExamBrand />
        <p className="text-incorrect">Matière introuvable.</p>
        <Link to="/" className="btn-secondary mt-6 inline-block">← Accueil</Link>
      </div>
    );
  }

  // Verrouillée: formulaire mot de passe.
  if (content?.locked) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <ExamBrand />
        <h1 className="title-display text-2xl text-center mb-2">{content.name}</h1>
        <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">Accès protégé</p>
        <form onSubmit={submitCode} className="card space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Mot de passe</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} type="text" autoComplete="off"
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white font-mono focus:border-accent outline-none" />
          </div>
          {error && <p className="text-incorrect text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Vérification…' : 'Accéder'}</button>
          <Link to="/" className="block text-center text-xs text-accent/70 hover:text-accent">← Autres matières</Link>
        </form>
      </div>
    );
  }

  const exams = content?.exams || [];
  const courses = content?.courses || [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <ExamBrand />
      <Link to="/" className="text-xs text-accent/70 hover:text-accent mb-6 inline-block">← Matières</Link>
      <h1 className="title-display text-2xl sm:text-3xl mb-1">{content.name}</h1>
      {content.description && <p className="text-sm text-muted mb-8">{content.description}</p>}

      <section className="mb-10">
        <h2 className="title-display text-sm tracking-[0.3em] mb-3">Examens</h2>
        {exams.length === 0 ? (
          <p className="text-muted italic text-sm">Aucun examen ouvert.</p>
        ) : (
          <ul className="grid gap-3">
            {exams.map((e) => (
              <li key={e.slug}>
                <Link to={`/exam/${e.slug}`} className="card block hover:border-accent/50 transition group">
                  <span className="text-white text-sm group-hover:text-accent transition">{e.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="title-display text-sm tracking-[0.3em] mb-3">Révision</h2>
        {courses.length === 0 ? (
          <p className="text-muted italic text-sm">Aucun quiz de révision.</p>
        ) : (
          <Link to={`/revision?subject=${encodeURIComponent(content.name)}`}
            className="card block hover:border-accent/60 transition group">
            <span className="title-display text-base group-hover:text-white transition">S'entraîner ({courses.length} cours)</span>
            <p className="text-xs text-muted mt-1">Quiz complet ou par cours.</p>
          </Link>
        )}
      </section>
    </div>
  );
}
