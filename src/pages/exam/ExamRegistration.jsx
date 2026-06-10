import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';
import DynamicForm, { extractFormData } from '../../components/DynamicForm.jsx';

const lsKey = (slug) => `examCandidate:${slug}`;
const draftKey = (slug) => `examRegistrationDraft:${slug}`;

export default function ExamRegistration() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm();

  useEffect(() => {
    (async () => {
      const existing = localStorage.getItem(lsKey(slug));
      const draft = localStorage.getItem(draftKey(slug));
      let { data, error: e } = await supabase
        .from('exams')
        .select('id, title, slug, is_open, requires_code, question_ids, pre_form_schema')
        .eq('slug', slug)
        .maybeSingle();
      if (e && /column .* does not exist/i.test(e.message || '')) {
        const fb = await supabase
          .from('exams')
          .select('id, title, slug, is_open, requires_code, question_ids')
          .eq('slug', slug)
          .maybeSingle();
        data = fb.data ? { ...fb.data, pre_form_schema: null } : null;
        e = fb.error;
      }
      if (e || !data) {
        setError('Examen introuvable ou fermé.');
      } else if (!data.is_open) {
        setError('Cet examen est fermé.');
      } else {
        setExam(data);
        if (draft) {
          try {
            reset(JSON.parse(draft));
          } catch {
            localStorage.removeItem(draftKey(slug));
          }
        }
        if (existing) {
          navigate(`/exam/${slug}/instructions`, { replace: true });
          return;
        }
      }
      setLoading(false);
    })();
  }, [slug, navigate, reset]);

  const onSubmit = async (values) => {
    setError(null);

    if (exam.requires_code) {
      const code = (values.access_code || '').trim();
      if (!code) {
        setError("Code d'accès requis.");
        return;
      }
      const { data: ok, error: vErr } = await supabase.rpc('verify_exam_code', {
        p_slug: slug,
        p_code: code
      });
      if (vErr) {
        setError(vErr.message);
        return;
      }
      if (!ok) {
        setError("Code d'accès incorrect.");
        return;
      }
    }

    const preFormData = extractFormData(values, exam.pre_form_schema || []);
    localStorage.setItem(
      draftKey(slug),
      JSON.stringify({
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
        telegram: values.telegram.trim(),
        access_code: (values.access_code || '').trim(),
        pre_form_data: preFormData
      })
    );
    navigate(`/exam/${slug}/instructions`);
  };

  if (loading) return <p className="text-muted p-10 text-center">Chargement…</p>;
  if (error && !exam) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="title-display text-xl mb-4">Indisponible</h1>
        <p className="text-incorrect">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="title-display text-2xl mb-2 text-center">{exam.title}</h1>
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">Inscription à l'examen</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Nom complet</label>
          <input
            {...register('full_name', { required: 'Nom requis', minLength: { value: 2, message: 'Min. 2 caractères' } })}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.full_name && <p className="text-incorrect text-xs mt-1">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Email</label>
          <input
            type="email"
            {...register('email', {
              required: 'Email requis',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' }
            })}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.email && <p className="text-incorrect text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Telegram (@pseudonyme)</label>
          <input
            {...register('telegram', {
              required: 'Telegram requis',
              pattern: { value: /^@?[A-Za-z0-9_]{3,}$/, message: 'Format invalide, ex: @pseudo' }
            })}
            placeholder="@pseudo"
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.telegram && <p className="text-incorrect text-xs mt-1">{errors.telegram.message}</p>}
        </div>

        {Array.isArray(exam.pre_form_schema) && exam.pre_form_schema.length > 0 && (
          <DynamicForm schema={exam.pre_form_schema} register={register} errors={errors} />
        )}

        {exam.requires_code && (
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Code d'accès</label>
            <input
              type="text"
              autoComplete="off"
              {...register('access_code', { required: "Code d'accès requis" })}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white font-mono focus:border-accent outline-none"
            />
            {errors.access_code && <p className="text-incorrect text-xs mt-1">{errors.access_code.message}</p>}
          </div>
        )}
        {error && <p className="text-incorrect text-sm">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Inscription…' : "S'inscrire"}
        </button>
      </form>
    </div>
  );
}
