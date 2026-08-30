import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';
import QuestionsBuilder from '../../components/QuestionsBuilder.jsx';
import FormSchemaBuilder from '../../components/FormSchemaBuilder.jsx';
import MatiereSelect from '../../components/MatiereSelect.jsx';
import { getType, getPoints } from '../../utils/questionModel.js';

const NEW_EXAM_DRAFT_KEY = 'quiz-qawaid:new-exam-draft';

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
  const { isPlatformAdmin } = useAuth();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draftLoaded, setDraftLoaded] = useState(!isNew);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [form, setForm] = useState({
    title: '',
    slug: '',
    instructions: '',
    subject: '',
    course_id: '',
    class_id: '',
    is_open: false,
    access_code: '',
    certificate_min_score: '',
    questions: [],
    pre_form_schema: null,
    post_form_schema: null
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [courses, setCourses] = useState([]); // cours de la matière choisie (1 examen par cours)
  const [classes, setClasses] = useState([]); // classes de l'instance (portée facultative)

  useEffect(() => {
    if (!isNew) return;
    try {
      const raw = window.localStorage.getItem(NEW_EXAM_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === 'object') {
          setForm((current) => ({ ...current, ...draft }));
          setSlugTouched(Boolean(draft.slug));
        }
      }
    } catch {
      window.localStorage.removeItem(NEW_EXAM_DRAFT_KEY);
    } finally {
      setDraftLoaded(true);
    }
  }, [isNew]);

  useEffect(() => {
    if (!isNew || !draftLoaded) return;
    const hasContent =
      form.title.trim() ||
      form.slug.trim() ||
      form.instructions.trim() ||
      form.subject.trim() ||
      form.access_code.trim() ||
      form.questions.length > 0 ||
      form.pre_form_schema ||
      form.post_form_schema;

    if (!hasContent) {
      window.localStorage.removeItem(NEW_EXAM_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(NEW_EXAM_DRAFT_KEY, JSON.stringify(form));
  }, [draftLoaded, form, isNew]);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const cols = 'title, slug, instructions, subject, course_id, class_id, is_open, access_code, certificate_min_score, question_ids, questions_snapshot, pre_form_schema, post_form_schema, tenant_id';
      let { data, error: e } = await supabase.from('exams').select(cols).eq('id', id).maybeSingle();
      // Rétrocompat: si une colonne récente manque, retomber sur le minimum.
      if (e && /column .* does not exist/i.test(e.message || '')) {
        const fb = await supabase
          .from('exams')
          .select('title, slug, instructions, is_open, access_code, question_ids')
          .eq('id', id)
          .maybeSingle();
        data = fb.data
          ? { ...fb.data, subject: null, course_id: null, class_id: null, certificate_min_score: null, questions_snapshot: null, pre_form_schema: null, post_form_schema: null }
          : null;
        e = fb.error;
      }
      if (e || !data) {
        setError(e?.message || 'Examen introuvable');
      } else {
        // Questions: snapshot prioritaire, sinon résolution des ids depuis la banque.
        let questions = Array.isArray(data.questions_snapshot) && data.questions_snapshot.length > 0
          ? data.questions_snapshot
          : [];

        setForm({
          title: data.title,
          slug: data.slug,
          instructions: data.instructions || '',
          subject: data.subject || '',
          course_id: data.course_id || '',
          class_id: data.class_id || '',
          is_open: data.is_open,
          access_code: data.access_code || '',
          certificate_min_score: typeof data.certificate_min_score === 'number' ? String(data.certificate_min_score) : '80',
          questions,
          pre_form_schema: data.pre_form_schema || null,
          post_form_schema: data.post_form_schema || null
        });
        setTenantId(data.tenant_id || '');
        setSlugTouched(true);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  // Platform-admin: liste des tenants pour ranger l'examen sous le bon (ex: Hisnul Mouslim).
  useEffect(() => {
    if (!isPlatformAdmin) return;
    supabase
      .from('tenants')
      .select('id, name')
      .order('name')
      .then(({ data }) => { if (data) setTenants(data); });
  }, [isPlatformAdmin]);

  // Classes de l'instance: un examen peut être réservé à l'une d'elles.
  useEffect(() => {
    let query = supabase.from('classes').select('id, name').order('position').order('name');
    if (isPlatformAdmin && tenantId) query = query.eq('tenant_id', tenantId);
    query.then(({ data }) => setClasses(data || []));
  }, [isPlatformAdmin, tenantId]);

  // Cours de la matière choisie. `quiz_courses.subject` porte le libellé canonique
  // de la matière (normalisé par le trigger find-or-create), d'où la jointure par nom.
  useEffect(() => {
    if (!form.subject) { setCourses([]); return; }
    let query = supabase
      .from('quiz_courses')
      .select('id, number, title')
      .eq('subject', form.subject)
      .order('created_at')
      .order('position');
    if (isPlatformAdmin && tenantId) query = query.eq('tenant_id', tenantId);
    query.then(({ data }) => {
      const list = data || [];
      setCourses(list);
      // Changement de matière: un cours d'une autre matière ne doit pas rester sélectionné.
      setForm((f) => (f.course_id && !list.some((c) => c.id === f.course_id) ? { ...f, course_id: '' } : f));
    });
  }, [form.subject, isPlatformAdmin, tenantId]);

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
    if (form.questions.length === 0) {
      setError('Ajoutez au moins une question');
      return;
    }
    const minScore = Number.parseInt(form.certificate_min_score, 10);
    if (Number.isNaN(minScore) || minScore < 0 || minScore > 100) {
      setError('Le score minimal certificat doit être un nombre entre 0 et 100.');
      return;
    }
    // Garde anti-collision: deux champs de même clé écrasent leur réponse dans
    // pre_form_data/post_form_data. Refuser la sauvegarde tant que ce n'est pas corrigé.
    const dupKey = (schema) => {
      const seen = new Set();
      for (const f of schema || []) {
        if (seen.has(f.key)) return f.key;
        seen.add(f.key);
      }
      return null;
    };
    const dup = dupKey(form.pre_form_schema) || dupKey(form.post_form_schema);
    if (dup) {
      setError(`Clé de champ formulaire dupliquée : "${dup}". Chaque champ doit avoir une clé unique (renommez le libellé).`);
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      instructions: form.instructions,
      subject: form.subject.trim() === '' ? null : form.subject.trim(),
      course_id: form.course_id || null,
      class_id: form.class_id || null,
      is_open: form.is_open,
      access_code: form.access_code.trim() === '' ? null : form.access_code.trim(),
      certificate_min_score: minScore,
      question_ids: form.questions.map((q) => q.id),
      questions_snapshot: form.questions,
      pre_form_schema: form.pre_form_schema,
      post_form_schema: form.post_form_schema
    };
    // Platform-admin: rattachement explicite à un tenant (sinon le trigger hérite du créateur).
    if (isPlatformAdmin && tenantId) {
      payload.tenant_id = tenantId;
    }
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
    if (isNew) {
      window.localStorage.removeItem(NEW_EXAM_DRAFT_KEY);
    }
    navigate('/admin', { replace: true });
  };

  if (loading) return <p className="text-muted p-10">Chargement…</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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
          {isPlatformAdmin && (
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-accent mb-2">Instance / Tenant</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
              >
                <option value="">— Mon instance par défaut —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted mt-1">Détermine sous quelle instance l'examen est rangé (ex: Hisnul Mouslim).</p>
            </div>
          )}
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
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">
              Sujet / Matière <span className="text-muted normal-case tracking-normal">(facultatif)</span>
            </label>
            <MatiereSelect
              value={form.subject}
              onChange={(v) => setField('subject', v)}
              tenantId={isPlatformAdmin ? tenantId : undefined}
              allowEmpty
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">
              Cours <span className="text-muted normal-case tracking-normal">(facultatif — rattache l'examen à un cours pour le suivi des élèves)</span>
            </label>
            <select
              value={form.course_id}
              onChange={(e) => setField('course_id', e.target.value)}
              disabled={!form.subject}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none disabled:opacity-50"
            >
              <option value="">— Aucun —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number != null ? `#${c.number} · ` : ''}{c.title}
                </option>
              ))}
            </select>
            {!form.subject && <p className="text-[10px] text-muted mt-1">Choisissez d'abord une matière.</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">
              Réservé à une classe <span className="text-muted normal-case tracking-normal">(facultatif)</span>
            </label>
            <select
              value={form.class_id}
              onChange={(e) => setField('class_id', e.target.value)}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
            >
              <option value="">— Toutes les classes —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-[10px] text-muted mt-1">
              Une classe choisie retire aussi cet examen de la vitrine publique.
            </p>
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

        <div className="card grid lg:grid-cols-2 gap-6">
          <FormSchemaBuilder
            label="Formulaire avant examen"
            value={form.pre_form_schema}
            onChange={(s) => setField('pre_form_schema', s)}
          />
          <FormSchemaBuilder
            label="Formulaire après examen"
            value={form.post_form_schema}
            onChange={(s) => setField('post_form_schema', s)}
          />
        </div>

        <div className="card">
          <QuestionsBuilder
            value={form.questions}
            onChange={(qs) => setField('questions', qs)}
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
