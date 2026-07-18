import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';
import MatiereSelect from '../../components/MatiereSelect.jsx';

// Banque de quiz de révision: cours par matière. Ajout progressif du contenu.
export default function QuizBank() {
  const { isPlatformAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ subject: '', number: '', title: '', course_date: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      if (data) { setTenants(data); if (data[0]) setTenantId((t) => t || data[0].id); }
    });
  }, [isPlatformAdmin]);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('quiz_courses')
      .select('id, subject, number, title, course_date, position, quiz_questions(count)')
      .order('subject')
      .order('position');
    if (isPlatformAdmin && tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error: e } = await query;
    if (e) setError(e.message);
    else setCourses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isPlatformAdmin && !tenantId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isPlatformAdmin]);

  const addCourse = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.title.trim()) { setError('Matière et titre requis.'); return; }
    setSaving(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      subject: form.subject.trim(),
      number: form.number === '' ? null : Number.parseInt(form.number, 10),
      title: form.title.trim(),
      course_date: form.course_date.trim() || null,
      created_by: userData.user?.id
    };
    if (isPlatformAdmin && tenantId) payload.tenant_id = tenantId;
    const { error: er } = await supabase.from('quiz_courses').insert(payload);
    setSaving(false);
    if (er) { setError(er.message); return; }
    setForm({ subject: form.subject, number: '', title: '', course_date: '' });
    load();
  };

  // Regroupe par matière pour l'affichage.
  const bySubject = courses.reduce((acc, c) => {
    (acc[c.subject] = acc[c.subject] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="title-display text-2xl">Banque de quiz (révision)</h1>
        {isPlatformAdmin && (
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none"
          >
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <form onSubmit={addCourse} className="card mb-6 grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Matière</label>
          <MatiereSelect
            value={form.subject}
            onChange={(v) => setForm((f) => ({ ...f, subject: v }))}
            tenantId={isPlatformAdmin ? tenantId : undefined}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">N° d'unité (option)</label>
          <input
            type="number"
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Date (option)</label>
          <input
            value={form.course_date}
            onChange={(e) => setForm((f) => ({ ...f, course_date: e.target.value }))}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Titre du cours</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Ajout…' : 'Ajouter le cours'}</button>
        </div>
      </form>

      {error && <p className="text-incorrect text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : courses.length === 0 ? (
        <p className="text-muted italic">Aucun cours. Ajoutez-en un ci-dessus.</p>
      ) : (
        Object.entries(bySubject).map(([subject, list]) => (
          <section key={subject} className="mb-8">
            <h2 className="title-display text-sm tracking-[0.2em] text-accent mb-3">{subject}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/quiz/${c.id}`} className="card block hover:border-accent/50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {c.number != null && <div className="text-[10px] text-accent font-bold uppercase tracking-widest mb-1">Unité {c.number}</div>}
                        <div className="text-white text-sm">{c.title}</div>
                        {c.course_date && <div className="text-[10px] text-muted mt-1">{c.course_date}</div>}
                      </div>
                      <span className="text-[10px] text-muted uppercase shrink-0">{c.quiz_questions?.[0]?.count ?? 0} q.</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
