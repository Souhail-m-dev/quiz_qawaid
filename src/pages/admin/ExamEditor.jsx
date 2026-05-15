import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import QuestionPicker from '../../components/QuestionPicker.jsx';

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default function ExamEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    instructions: '',
    is_open: false,
    access_code: '',
    certificate_min_score: '',
    question_ids: []
  });
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      let { data, error: e } = await supabase
        .from('exams')
        .select('title, slug, instructions, is_open, access_code, certificate_min_score, question_ids')
        .eq('id', id)
        .maybeSingle();
      if (e && /certificate_min_score/i.test(e.message || '')) {
        const fallback = await supabase
          .from('exams')
          .select('title, slug, instructions, is_open, access_code, question_ids')
          .eq('id', id)
          .maybeSingle();
        data = fallback.data ? { ...fallback.data, certificate_min_score: null } : null;
        e = fallback.error;
      }
      if (e || !data) {
        setError(e?.message || 'Examen introuvable');
      } else {
        setForm({
          title: data.title,
          slug: data.slug,
          instructions: data.instructions || '',
          is_open: data.is_open,
          access_code: data.access_code || '',
          certificate_min_score: typeof data.certificate_min_score === 'number' ? String(data.certificate_min_score) : '80',
          question_ids: Array.isArray(data.question_ids) ? data.question_ids : []
        });
        setSlugTouched(true);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onTitleChange = (v) => {
    setField('title', v);
    if (!slugTouched) setField('slug', slugify(v));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.slug.trim()) {
      setError('Titre et slug requis');
      return;
    }
    if (form.question_ids.length === 0) {
      setError('Sélectionnez au moins une question');
      return;
    }
    const minScore = Number.parseInt(form.certificate_min_score, 10);
    if (Number.isNaN(minScore) || minScore < 0 || minScore > 100) {
      setError('Le score minimal certificat doit être un nombre entre 0 et 100.');
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      instructions: form.instructions,
      is_open: form.is_open,
      access_code: form.access_code.trim() === '' ? null : form.access_code.trim(),
      certificate_min_score: minScore,
      question_ids: form.question_ids
    };
    let result;
    if (isNew) {
      payload.created_by = userData.user?.id;
      result = await supabase.from('exams').insert(payload).select('id').single();
    } else {
      result = await supabase.from('exams').update(payload).eq('id', id).select('id').single();
    }
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    navigate('/admin', { replace: true });
  };

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="title-display text-2xl">{isNew ? 'Nouvel examen' : 'Éditer l\'examen'}</h1>
        <button type="button" onClick={() => navigate('/admin')} className="btn-secondary">← Retour</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="card grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Titre</label>
            <input
              value={form.title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Slug (URL)</label>
            <input
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); setField('slug', slugify(e.target.value)); }}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white font-mono text-sm focus:border-accent outline-none"
              required
            />
            <p className="text-[10px] text-muted mt-1">URL: /exam/{form.slug || '…'}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Instructions (affichées avant l'examen)</label>
            <textarea
              value={form.instructions}
              onChange={(e) => setField('instructions', e.target.value)}
              rows={6}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none whitespace-pre-wrap"
              placeholder="Vous disposez de … L'examen comporte … Bonne chance !"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">
              Code d'accès <span className="text-muted normal-case tracking-normal">(facultatif — laisser vide pour examen public)</span>
            </label>
            <input
              type="text"
              value={form.access_code}
              onChange={(e) => setField('access_code', e.target.value)}
              placeholder="ex: ramadan2026"
              autoComplete="off"
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white font-mono focus:border-accent outline-none"
            />
            <p className="text-[10px] text-muted mt-1">
              {form.access_code.trim()
                ? "Les candidats devront saisir ce code pour s'inscrire."
                : 'Aucun code requis — inscription libre.'}
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">
              Score minimal certificat (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.certificate_min_score}
              onChange={(e) => setField('certificate_min_score', e.target.value)}
              placeholder="ex: 80"
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white font-mono focus:border-accent outline-none"
              required
            />
            <p className="text-[10px] text-muted mt-1">
              Certificat générable seulement si score {'>='} ce seuil et examen soumis.
            </p>
          </div>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_open}
              onChange={(e) => setField('is_open', e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-sm">Ouvert aux candidats</span>
            <span className="text-[10px] text-muted">(décochez pour fermer les inscriptions)</span>
          </label>
        </div>

        <div className="card">
          <QuestionPicker
            value={form.question_ids}
            onChange={(qids) => setField('question_ids', qids)}
          />
        </div>

        {error && <p className="text-incorrect text-sm">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin')} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
