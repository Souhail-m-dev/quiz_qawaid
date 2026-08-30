import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';
import DynamicForm, { extractFormData } from '../../components/DynamicForm.jsx';
import ExamBrand from '../../components/ExamBrand.jsx';
import { TENANT_HOST } from '../../lib/tenantHost.js';

const lsKey = (slug) => `examCandidate:${slug}`;
const draftKey = (slug) => `examRegistrationDraft:${slug}`;
// Code d'accès mémorisé par matière (host = tenant) : saisi une fois, réutilisé sur
// tous les quizz de la même matière partageant le même code.
const subjKey = (subject) => `subjectAccess:${TENANT_HOST}:${subject}`;

export default function ExamRegistration() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memoCode, setMemoCode] = useState(null); // code matière déjà validé (saute la saisie)
  const [student, setStudent] = useState(null);   // élève connecté et inscrit à la matière de l'examen
  const { role, status, loading: authLoading } = useAuth();
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
        .select('id, title, slug, subject, subject_id, is_open, requires_code, question_ids, pre_form_schema')
        .eq('slug', slug)
        .maybeSingle();
      if (e && /column .* does not exist/i.test(e.message || '')) {
        const fb = await supabase
          .from('exams')
          .select('id, title, slug, is_open, requires_code, question_ids')
          .eq('slug', slug)
          .maybeSingle();
        data = fb.data ? { ...fb.data, subject: null, subject_id: null, pre_form_schema: null } : null;
        e = fb.error;
      }
      if (e || !data) {
        setError('Examen introuvable ou fermé.');
      } else if (!data.is_open) {
        setError('Cet examen est fermé.');
      } else {
        setExam(data);
        // Matière déjà débloquée ? Re-valide le code mémorisé côté serveur.
        if (data.requires_code && data.subject) {
          const stored = localStorage.getItem(subjKey(data.subject));
          if (stored) {
            const { data: ok } = await supabase.rpc('verify_exam_code', { p_slug: slug, p_code: stored });
            if (ok) setMemoCode(stored);
          }
        }
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

  // Élève connecté et validé: préremplir son identité, et sauter le code d'accès
  // s'il est inscrit à la matière de cet examen (l'inscription remplace le code).
  useEffect(() => {
    if (authLoading || !exam || role !== 'eleve' || status !== 'approved') return;
    (async () => {
      const { data: me } = await supabase.rpc('student_me');
      if (!me) return;
      const enrolled = (me.matieres || []).some((m) => m.id === exam.subject_id);
      setStudent({ ...me, enrolled });
      reset((prev) => ({ ...prev, full_name: me.full_name || '', email: me.email || '' }));
    })();
  }, [authLoading, exam, role, status, reset]);

  const onSubmit = async (values) => {
    setError(null);

    let code = memoCode;
    if (exam.requires_code && !student?.enrolled) {
      if (!memoCode) {
        code = (values.access_code || '').trim();
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
      // Mémorise le code au niveau matière pour les prochains quizz de la même matière.
      if (exam.subject && code) localStorage.setItem(subjKey(exam.subject), code);
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
      <ExamBrand />
      <h1 className="title-display text-2xl mb-2 text-center">{exam.title}</h1>
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">Inscription à l'examen</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Nom complet</label>
          <input
            readOnly={!!student}
            {...register('full_name', { required: 'Nom requis', minLength: { value: 2, message: 'Min. 2 caractères' } })}
            className={`w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none ${student ? 'opacity-70' : ''}`}
          />
          {errors.full_name && <p className="text-incorrect text-xs mt-1">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Email</label>
          <input
            type="email"
            readOnly={!!student}
            {...register('email', {
              required: 'Email requis',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' }
            })}
            className={`w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none ${student ? 'opacity-70' : ''}`}
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

        {exam.requires_code && student?.enrolled && (
          <p className="text-xs text-muted">Inscrit à « {exam.subject} » : aucun code requis.</p>
        )}
        {exam.requires_code && !student?.enrolled && memoCode && (
          <p className="text-xs text-muted">Accès « {exam.subject} » déjà validé sur cet appareil.</p>
        )}
        {exam.requires_code && !student?.enrolled && !memoCode && (
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
