import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import data from '../../data/questions.json';
import { getAllQuestions } from '../../utils/quizUtils.js';
import { supabase } from '../../lib/supabase.js';
import {
  downloadBlob,
  formatCertificateDate,
  generateCertificatePdfBlob,
  generateCertificatePngBlob,
  isCertificateEligible,
  sanitizeFileName
} from '../../utils/certificates.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function CandidateAttemptDetail() {
  const { id, candidateId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exam, setExam] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      let { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('id, title, slug, question_ids, questions_snapshot, certificate_min_score')
        .eq('id', id)
        .maybeSingle();
      if (examErr && /questions_snapshot/i.test(examErr.message || '')) {
        const fallback = await supabase
          .from('exams')
          .select('id, title, slug, question_ids, certificate_min_score')
          .eq('id', id)
          .maybeSingle();
        examData = fallback.data ? { ...fallback.data, questions_snapshot: null } : null;
        examErr = fallback.error;
      }
      if (examErr || !examData) {
        setError(examErr?.message || 'Examen introuvable.');
        setLoading(false);
        return;
      }
      setExam(examData);

      const { data: candData, error: candErr } = await supabase
        .from('candidates')
        .select('id, full_name, email, telegram, created_at')
        .eq('id', candidateId)
        .eq('exam_id', id)
        .maybeSingle();
      if (candErr || !candData) {
        setError(candErr?.message || 'Candidat introuvable.');
        setLoading(false);
        return;
      }
      setCandidate(candData);

      const { data: attempts, error: attemptErr } = await supabase
        .from('attempts')
        .select('id, answers, score, total, submitted_at, started_at')
        .eq('exam_id', id)
        .eq('candidate_id', candidateId)
        .order('started_at', { ascending: false })
        .limit(1);
      if (attemptErr) {
        setError(attemptErr.message);
        setLoading(false);
        return;
      }

      setAttempt(Array.isArray(attempts) ? attempts[0] || null : null);
      setLoading(false);
    })();
  }, [id, candidateId]);

  const answerRows = useMemo(() => {
    if (!exam || !attempt?.answers) return [];
    const snapshot = Array.isArray(exam.questions_snapshot) ? exam.questions_snapshot : null;
    const byId = snapshot && snapshot.length > 0
      ? Object.fromEntries(snapshot.map((q) => [q.id, q]))
      : Object.fromEntries(getAllQuestions(data).map((q) => [q.id, q]));
    return attempt.answers.map((a, idx) => {
      const q = byId[a.questionId];
      const selectedLabel = q && typeof a.reponseChoisie === 'number' ? q.options[a.reponseChoisie] : null;
      const correctLabel = q && typeof q.reponseCorrecte === 'number' ? q.options[q.reponseCorrecte] : null;
      return {
        key: `${a.questionId || 'q'}-${idx}`,
        ok: !!a.estCorrecte,
        question: q?.question || a.questionId || 'Question inconnue',
        selectedLabel: selectedLabel || '—',
        correctLabel: correctLabel || '—'
      };
    });
  }, [exam, attempt]);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (error) return <p className="text-incorrect p-10">{error}</p>;

  const minScore = typeof exam?.certificate_min_score === 'number' ? exam.certificate_min_score : null;
  const eligible = isCertificateEligible(attempt, minScore);

  const downloadCertificate = async (format) => {
    if (!eligible || !candidate || !exam) return;
    setGenerating(true);
    try {
      const day = new Date().toISOString().slice(0, 10);
      const dateLabel = formatCertificateDate(new Date());
      const baseName = `certificat-${sanitizeFileName(exam.slug)}-${sanitizeFileName(candidate.full_name)}-${day}`;
      const png = await generateCertificatePngBlob({
        studentName: candidate.full_name,
        dateLabel
      });
      if (format === 'png') {
        downloadBlob(png, `${baseName}.png`);
      } else {
        const pdf = await generateCertificatePdfBlob({ pngBlob: png });
        downloadBlob(pdf, `${baseName}.pdf`);
      }
    } catch (e) {
      setError(e?.message || 'Échec de génération du certificat.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="title-display text-2xl">{candidate?.full_name}</h1>
          <p className="text-xs text-muted">/exam/{exam?.slug}</p>
        </div>
        <Link to={`/admin/exams/${id}/results`} className="btn-secondary">← Retour résultats</Link>
      </div>

      <div className="card mb-6 grid sm:grid-cols-2 gap-3 text-sm">
        <p><span className="text-muted">Email:</span> {candidate?.email}</p>
        <p><span className="text-muted">Telegram:</span> {candidate?.telegram}</p>
        <p><span className="text-muted">Inscrit le:</span> {formatDate(candidate?.created_at)}</p>
        <p><span className="text-muted">Début tentative:</span> {formatDate(attempt?.started_at)}</p>
        <p>
          <span className="text-muted">Statut:</span>{' '}
          {attempt?.submitted_at ? <span className="text-correct">Terminé</span> : attempt ? <span className="text-moyenne">En cours</span> : <span className="text-muted">Non commencé</span>}
        </p>
        <p>
          <span className="text-muted">Score:</span>{' '}
          {attempt?.submitted_at ? <span className="font-bold">{attempt.score}/{attempt.total}</span> : '—'}
        </p>
        <p><span className="text-muted">Soumis le:</span> {formatDate(attempt?.submitted_at)}</p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="title-display text-lg">Certificat</h2>
            <p className="text-xs text-muted">
              {minScore === null
                ? 'Seuil certificat non configuré sur cet examen.'
                : eligible
                  ? `Éligible: examen soumis avec score >= ${minScore}%.`
                  : `Non éligible: certificat réservé aux tentatives soumises avec score >= ${minScore}%.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={!eligible || generating}
              onClick={() => downloadCertificate('png')}
            >
              {generating ? 'Génération…' : 'Télécharger PNG'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!eligible || generating}
              onClick={() => downloadCertificate('pdf')}
            >
              {generating ? 'Génération…' : 'Télécharger PDF'}
            </button>
          </div>
        </div>
      </div>

      {!attempt?.answers || attempt.answers.length === 0 ? (
        <p className="text-muted italic">Aucune réponse enregistrée pour le moment.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-accent/20 text-accent uppercase tracking-widest text-[10px]">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Question</th>
                <th className="py-2 pr-3">Réponse étudiant</th>
                <th className="py-2 pr-3">Bonne réponse</th>
                <th className="py-2 pr-3">Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {answerRows.map((r, i) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 text-muted">{i + 1}</td>
                  <td className="py-2 pr-3 text-white">{r.question}</td>
                  <td className="py-2 pr-3">{r.selectedLabel}</td>
                  <td className="py-2 pr-3">{r.correctLabel}</td>
                  <td className="py-2 pr-3">{r.ok ? <span className="text-correct">Correct</span> : <span className="text-incorrect">Faux</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
