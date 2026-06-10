import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';

export default function AdminDashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    (async () => {
      let { data, error } = await supabase
        .from('exams')
        .select('id, slug, title, is_open, access_code, question_ids, questions_snapshot, created_at, candidates(count), attempts(count)')
        .order('created_at', { ascending: false });
      if (error && /questions_snapshot/i.test(error.message || '')) {
        const fallback = await supabase
          .from('exams')
          .select('id, slug, title, is_open, access_code, question_ids, created_at, candidates(count), attempts(count)')
          .order('created_at', { ascending: false });
        data = (fallback.data || []).map((e) => ({ ...e, questions_snapshot: null }));
        error = fallback.error;
      }
      if (!error) setExams(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="title-display text-xl sm:text-2xl">Tableau de bord</h1>
        {isAdmin && (
          <Link to="/admin/exams/new" className="btn-primary">+ Nouvel examen</Link>
        )}
      </div>

      {loading && <p className="text-muted">Chargement…</p>}
      {!loading && exams.length === 0 && (
        <p className="text-muted italic">Aucun examen. Créez-en un pour commencer.</p>
      )}

      {!loading && exams.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          {(() => {
            const totalInscrits = exams.reduce((s, e) => s + (e.candidates?.[0]?.count ?? 0), 0);
            const totalAttempts = exams.reduce((s, e) => s + (e.attempts?.[0]?.count ?? 0), 0);
            const cards = [
              { label: 'Examens', value: exams.length },
              { label: 'Inscrits', value: totalInscrits },
              { label: 'Tentatives', value: totalAttempts }
            ];
            return cards.map((c) => (
              <div key={c.label} className="card text-center py-4">
                <div className="text-3xl font-bold text-white">{c.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted mt-1">{c.label}</div>
              </div>
            ));
          })()}
        </div>
      )}

      <div className="grid gap-4">
        {exams.map((e) => (
          <div key={e.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="title-display text-lg">{e.title}</h2>
                <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${e.is_open ? 'bg-correct/20 text-correct' : 'bg-incorrect/20 text-incorrect'}`}>
                  {e.is_open ? 'Ouvert' : 'Fermé'}
                </span>
              </div>
              <p className="text-xs text-muted">
                /exam/{e.slug} · {Array.isArray(e.questions_snapshot) && e.questions_snapshot.length > 0
                  ? e.questions_snapshot.length
                  : Array.isArray(e.question_ids) ? e.question_ids.length : 0} questions ·
                {' '}{e.candidates?.[0]?.count ?? 0} inscrits ·
                {' '}{e.attempts?.[0]?.count ?? 0} attempts
              </p>
              <p className="text-xs text-muted mt-1">
                Code d'acces: {e.access_code?.trim() ? <span className="font-mono text-white">{e.access_code}</span> : 'aucun (public)'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && <Link to={`/admin/exams/${e.id}`} className="btn-secondary">Éditer</Link>}
              <Link to={`/admin/exams/${e.id}/stats`} className="btn-secondary">Stats</Link>
              <Link to={`/admin/exams/${e.id}/results`} className="btn-secondary">Résultats</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
