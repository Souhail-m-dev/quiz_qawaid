import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';
import DynamicForm, { extractFormData } from '../../components/DynamicForm.jsx';

const lsKey = (slug) => `examCandidate:${slug}`;

export default function ExamDone() {
  const { slug } = useParams();
  const [schema, setSchema] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    // Lire le candidat AVANT tout nettoyage (nécessaire pour le post-formulaire).
    let cid = null;
    try {
      const raw = localStorage.getItem(lsKey(slug));
      if (raw) cid = JSON.parse(raw).candidateId;
    } catch { /* ignore */ }
    setCandidateId(cid);

    (async () => {
      const { data } = await supabase
        .from('exams')
        .select('post_form_schema')
        .eq('slug', slug)
        .maybeSingle();
      const ps = Array.isArray(data?.post_form_schema) ? data.post_form_schema : null;
      setSchema(ps);
      // Pas de post-formulaire (ou pas de candidat): nettoyer tout de suite.
      if (!ps || ps.length === 0 || !cid) {
        localStorage.removeItem(lsKey(slug));
      }
    })();
  }, [slug]);

  const onSubmit = async (values) => {
    if (candidateId && schema?.length) {
      await supabase.rpc('save_candidate_post_form', {
        p_candidate_id: candidateId,
        p_data: extractFormData(values, schema)
      });
    }
    localStorage.removeItem(lsKey(slug));
    setDone(true);
  };

  const showForm = schema && schema.length > 0 && candidateId && !done;

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="card">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-correct/20 flex items-center justify-center text-correct text-3xl">✓</div>
        <h1 className="title-display text-2xl mb-3">Examen soumis</h1>
        <p className="text-sm text-white/80 leading-relaxed mb-2">Merci d'avoir passé l'examen.</p>
        <p className="text-sm text-muted leading-relaxed mb-6">
          Vos résultats vous seront communiqués prochainement par l'administrateur.
        </p>

        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="text-left space-y-5 border-t border-accent/20 pt-6 mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-accent text-center">Avant de partir</p>
            <DynamicForm schema={schema} register={register} errors={errors} />
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? 'Envoi…' : 'Envoyer'}
            </button>
          </form>
        )}

        <Link to="/" className="btn-secondary inline-block">Retour à l'accueil</Link>
      </div>
    </div>
  );
}
