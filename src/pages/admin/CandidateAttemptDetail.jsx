import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { isOpen as isOpenQ, effectivePoints, tallyScore } from '../../utils/questionModel.js';
import { certTemplateFor } from '../../config/certificateTemplates.js';
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

function fmtNum(n) {
  if (typeof n !== 'number') return n;
  return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function CandidateAttemptDetail() {
  const { id, candidateId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exam, setExam] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [savingIdx, setSavingIdx] = useState(null);
  const [validating, setValidating] = useState(false);
  const [members, setMembers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState(null);

  useEffect(() => {
    (async () => {
      let { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('id, title, slug, tenant_id, question_ids, questions_snapshot, certificate_min_score')
        .eq('id', id)
        .maybeSingle();
      if (examErr && /questions_snapshot/i.test(examErr.message || '')) {
        const fallback = await supabase
          .from('exams')
          .select('id, title, slug, tenant_id, question_ids, certificate_min_score')
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

      let { data: candData, error: candErr } = await supabase
        .from('candidates')
        .select('id, full_name, email, telegram, created_at, pre_form_data, post_form_data')
        .eq('id', candidateId)
        .eq('exam_id', id)
        .maybeSingle();
      if (candErr && /column .* does not exist/i.test(candErr.message || '')) {
        const fb = await supabase
          .from('candidates')
          .select('id, full_name, email, telegram, created_at')
          .eq('id', candidateId)
          .eq('exam_id', id)
          .maybeSingle();
        candData = fb.data ? { ...fb.data, pre_form_data: null, post_form_data: null } : null;
        candErr = fb.error;
      }
      if (candErr || !candData) {
        setError(candErr?.message || 'Candidat introuvable.');
        setLoading(false);
        return;
      }
      setCandidate(candData);

      const { data: attempts, error: attemptErr } = await supabase
        .from('attempts')
        .select('id, answers, score, total, submitted_at, started_at, graded_at, graded_by')
        .eq('exam_id', id)
        .eq('candidate_id', candidateId)
        .order('started_at', { ascending: false })
        .limit(1);
      if (attemptErr) {
        setError(attemptErr.message);
        setLoading(false);
        return;
      }

      const at = Array.isArray(attempts) ? attempts[0] || null : null;
      setAttempt(at);
      setAnswers(Array.isArray(at?.answers) ? at.answers : []);

      // Noms des correcteurs (RPC: joint auth.users). Owner -> tous les membres
      // du tenant; correcteur -> seulement lui (RLS de la fonction).
      const { data: mem } = await supabase.rpc('list_members');
      if (mem) setMembers(Object.fromEntries(mem.map((m) => [m.id, m.full_name || m.email || m.id])));

      setLoading(false);
    })();
  }, [id, candidateId]);

  const memberLabel = (uid) => (uid ? (members[uid] || 'Correcteur') : null);

  const byId = useMemo(() => {
    const snapshot = Array.isArray(exam?.questions_snapshot) ? exam.questions_snapshot : [];
    return Object.fromEntries(snapshot.map((q) => [q.id, q]));
  }, [exam]);

  const saveGrade = async (idx, rawPoints, note) => {
    const q = byId[answers[idx].questionId];
    const max = typeof answers[idx].pointsMax === 'number' ? answers[idx].pointsMax
      : (typeof q?.points === 'number' ? q.points : 1);
    let pts = Number(rawPoints);
    if (Number.isNaN(pts)) return;
    pts = Math.max(0, Math.min(pts, max));

    const { data: userData } = await supabase.auth.getUser();
    const next = answers.map((a, i) =>
      i === idx
        ? { ...a, correction: { points: pts, by: userData.user?.id || null, at: new Date().toISOString(), note: note || null } }
        : a
    );
    const { score, total } = tallyScore(next);

    setSavingIdx(idx);
    const { error: e } = await supabase
      .from('attempts')
      .update({ answers: next, score, total })
      .eq('id', attempt.id);
    setSavingIdx(null);
    if (e) {
      setError(e.message);
      return;
    }
    setAnswers(next);
    setAttempt((a) => ({ ...a, answers: next, score, total }));
    supabase.rpc('log_activity', {
      p_action: 'grade',
      p_exam_id: id,
      p_candidate_id: candidateId,
      p_attempt_id: attempt.id,
      p_meta: { questionId: next[idx].questionId, points: pts, max }
    });
  };

  const setGraded = async (validated) => {
    if (!attempt) return;
    setValidating(true);
    const { data: u } = await supabase.auth.getUser();
    const patch = validated
      ? { graded_at: new Date().toISOString(), graded_by: u.user?.id || null }
      : { graded_at: null, graded_by: null };
    const { error: e } = await supabase.from('attempts').update(patch).eq('id', attempt.id);
    setValidating(false);
    if (e) { setError(e.message); return; }
    setAttempt((a) => ({ ...a, ...patch }));
    supabase.rpc('log_activity', {
      p_action: validated ? 'correction_validated' : 'correction_reopened',
      p_exam_id: id, p_candidate_id: candidateId, p_attempt_id: attempt.id, p_meta: {}
    });
  };

  const rows = useMemo(() => {
    return answers.map((a, idx) => {
      const q = byId[a.questionId];
      const open = q ? isOpenQ(q) : (typeof a.reponseTexte === 'string');
      const selectedLabel = q && typeof a.reponseChoisie === 'number' ? q.options?.[a.reponseChoisie] : null;
      const correctLabel = q && typeof q.reponseCorrecte === 'number' ? q.options?.[q.reponseCorrecte] : null;
      const max = typeof a.pointsMax === 'number' ? a.pointsMax : (typeof q?.points === 'number' ? q.points : 1);
      return {
        idx,
        key: `${a.questionId || 'q'}-${idx}`,
        open,
        question: q?.question || a.questionId || 'Question inconnue',
        reponseTexte: a.reponseTexte || '',
        modelAnswer: q?.modelAnswer || null,
        acceptedAnswers: q?.grading?.acceptedAnswers || null,
        selectedLabel: selectedLabel || '—',
        correctLabel: correctLabel || '—',
        points: effectivePoints(a),
        max,
        needsReview: !!a.needsReview && !a.correction,
        corrected: !!a.correction,
        correctionBy: a.correction?.by || null,
        correctionAt: a.correction?.at || null,
        ok: a.correction ? effectivePoints(a) === max : !!a.estCorrecte
      };
    });
  }, [answers, byId]);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (error) return <p className="text-incorrect p-10">{error}</p>;

  const minScore = typeof exam?.certificate_min_score === 'number' ? exam.certificate_min_score : null;
  const eligible = isCertificateEligible(attempt, minScore);
  const certTemplate = certTemplateFor(exam?.tenant_id); // null => instance sans certificat
  const canCertify = eligible && !!certTemplate;          // un certificat sera émis
  const canSend = !!candidate?.email && !!attempt?.submitted_at; // email possible (avec ou sans cert)

  const downloadCertificate = async (format) => {
    if (!canCertify || !candidate || !exam) return;
    setGenerating(true);
    try {
      const day = new Date().toISOString().slice(0, 10);
      const dateLabel = formatCertificateDate(new Date(attempt.submitted_at));
      const baseName = `certificat-${sanitizeFileName(exam.slug)}-${sanitizeFileName(candidate.full_name)}-${day}`;
      const png = await generateCertificatePngBlob({
        studentName: candidate.full_name,
        dateLabel,
        templateUrl: certTemplate
      });
      if (format === 'png') {
        downloadBlob(png, `${baseName}.png`);
      } else {
        const pdf = await generateCertificatePdfBlob({ pngBlob: png });
        downloadBlob(pdf, `${baseName}.pdf`);
      }
      supabase.rpc('log_activity', {
        p_action: 'certificate_download',
        p_exam_id: id, p_candidate_id: candidateId, p_attempt_id: attempt?.id || null,
        p_meta: { format }
      });
    } catch (e) {
      setError(e?.message || 'Échec de génération du certificat.');
    } finally {
      setGenerating(false);
    }
  };

  const sendCertificateEmail = async () => {
    if (!canSend || !exam) return;
    setSending(true);
    setSendMsg(null);
    try {
      const body = {
        to: candidate.email,
        studentName: candidate.full_name,
        examId: exam.id,
        examTitle: exam.title,
        score: attempt.score,
        total: attempt.total
      };
      // Certificat joint uniquement si l'instance en émet un et le candidat est éligible.
      if (canCertify) {
        const day = new Date().toISOString().slice(0, 10);
        const dateLabel = formatCertificateDate(new Date(attempt.submitted_at));
        const baseName = `certificat-${sanitizeFileName(exam.slug)}-${sanitizeFileName(candidate.full_name)}-${day}`;
        const png = await generateCertificatePngBlob({
          studentName: candidate.full_name,
          dateLabel,
          templateUrl: certTemplate
        });
        const pdf = await generateCertificatePdfBlob({ pngBlob: png });
        body.pdfBase64 = await blobToBase64(pdf);
        body.fileName = `${baseName}.pdf`;
      }
      const { error: fnError } = await supabase.functions.invoke('send-certificate', { body });
      if (fnError) {
        let detail = fnError.message;
        try {
          const ctx = await fnError.context?.json?.();
          if (ctx?.error) detail = ctx.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      supabase.rpc('log_activity', {
        p_action: body.pdfBase64 ? 'certificate_email' : 'result_email',
        p_exam_id: id, p_candidate_id: candidateId, p_attempt_id: attempt?.id || null,
        p_meta: { to: candidate.email }
      });
      setSendMsg({ type: 'ok', text: `${body.pdfBase64 ? 'Certificat' : 'Résultat'} envoyé à ${candidate.email}.` });
    } catch (e) {
      setSendMsg({ type: 'err', text: e?.message || "Échec de l'envoi." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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
          {attempt?.submitted_at ? <span className="font-bold">{fmtNum(attempt.score)}/{fmtNum(attempt.total)}</span> : '—'}
        </p>
        <p><span className="text-muted">Soumis le:</span> {formatDate(attempt?.submitted_at)}</p>
      </div>

      {attempt && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="title-display text-lg">Correction</h2>
            <p className="text-xs text-muted">
              {attempt.graded_at
                ? `Validée le ${formatDate(attempt.graded_at)}${attempt.graded_by ? ` par ${memberLabel(attempt.graded_by)}` : ''}.`
                : (() => {
                    const pending = rows.filter((r) => r.needsReview).length;
                    return pending > 0
                      ? `Non validée · ${pending} réponse(s) à revoir.`
                      : 'Non validée.';
                  })()}
            </p>
          </div>
          {attempt.graded_at ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={validating}
              onClick={() => setGraded(false)}
            >
              {validating ? '…' : 'Rouvrir la correction'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={validating || !attempt.submitted_at}
              onClick={() => setGraded(true)}
              title={!attempt.submitted_at ? 'Tentative non soumise.' : undefined}
            >
              {validating ? 'Validation…' : 'Valider la correction'}
            </button>
          )}
        </div>
      )}

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="title-display text-lg">{certTemplate ? 'Certificat' : 'Résultat'}</h2>
            <p className="text-xs text-muted">
              {!certTemplate
                ? "Cette instance n'émet pas de certificat. Le résultat peut être envoyé par email."
                : minScore === null
                  ? 'Seuil certificat non configuré sur cet examen.'
                  : eligible
                    ? `Éligible: examen soumis avec score >= ${minScore}%.`
                    : `Non éligible: certificat réservé aux tentatives soumises avec score >= ${minScore}%.`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {certTemplate && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!canCertify || generating}
                  onClick={() => downloadCertificate('png')}
                >
                  {generating ? 'Génération…' : 'Télécharger PNG'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!canCertify || generating}
                  onClick={() => downloadCertificate('pdf')}
                >
                  {generating ? 'Génération…' : 'Télécharger PDF'}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={!canSend || sending || generating}
              onClick={sendCertificateEmail}
              title={!candidate?.email ? 'Aucun email pour ce candidat.' : undefined}
            >
              {sending ? 'Envoi…' : (canCertify ? 'Envoyer le certificat' : 'Envoyer le résultat par mail')}
            </button>
          </div>
        </div>
        {sendMsg && (
          <p className={`mt-3 text-sm ${sendMsg.type === 'ok' ? 'text-correct' : 'text-incorrect'}`}>
            {sendMsg.text}
          </p>
        )}
      </div>

      {(candidate?.pre_form_data && Object.keys(candidate.pre_form_data).length > 0) && (
        <FormDataCard title="Formulaire avant examen" data={candidate.pre_form_data} />
      )}
      {(candidate?.post_form_data && Object.keys(candidate.post_form_data).length > 0) && (
        <FormDataCard title="Formulaire après examen" data={candidate.post_form_data} />
      )}

      {rows.length === 0 ? (
        <p className="text-muted italic">Aucune réponse enregistrée pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <AnswerCard
              key={r.key}
              row={r}
              saving={savingIdx === r.idx}
              onSave={(pts, note) => saveGrade(r.idx, pts, note)}
              correctorLabel={r.correctionBy ? memberLabel(r.correctionBy) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FormDataCard({ title, data }) {
  return (
    <div className="card mb-6">
      <h2 className="title-display text-lg mb-3">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        {Object.entries(data).map(([k, v]) => (
          <p key={k}>
            <span className="text-muted">{k}:</span>{' '}
            <span className="text-white/90">{v === true ? 'Oui' : v === false ? 'Non' : (v ?? '—')}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function AnswerCard({ row, saving, onSave, correctorLabel }) {
  const [points, setPoints] = useState(String(row.points));
  const [note, setNote] = useState('');

  useEffect(() => { setPoints(String(row.points)); }, [row.points]);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-white text-sm flex-1">
          <span className="text-accent font-bold mr-2">Q{row.idx + 1}</span>{row.question}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {row.needsReview && <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-moyenne/20 text-moyenne">à revoir</span>}
          {row.corrected && <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-accent/20 text-accent">corrigé</span>}
          <span className={`text-sm font-bold ${row.ok ? 'text-correct' : 'text-incorrect'}`}>
            {fmtNum(row.points)}/{fmtNum(row.max)}
          </span>
        </div>
      </div>
      {row.corrected && (
        <p className="text-[11px] text-muted mb-2">
          Corrigé{correctorLabel ? ` par ${correctorLabel}` : ''}{row.correctionAt ? ` le ${formatDate(row.correctionAt)}` : ''}
        </p>
      )}

      {row.open ? (
        <div className="space-y-2 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Réponse de l'étudiant</p>
            <p className="text-white/90 whitespace-pre-wrap bg-bg/40 rounded p-2">{row.reponseTexte || <em className="text-muted">(vide)</em>}</p>
          </div>
          {row.modelAnswer && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Réponse de référence</p>
              <p className="text-white/70 whitespace-pre-wrap">{row.modelAnswer}</p>
            </div>
          )}
          {row.acceptedAnswers && row.acceptedAnswers.length > 0 && (
            <p className="text-xs text-muted">Réponses acceptées: {row.acceptedAnswers.join(' · ')}</p>
          )}
        </div>
      ) : (
        <div className="text-sm grid sm:grid-cols-2 gap-2">
          <p><span className="text-muted">Réponse:</span> {row.selectedLabel}</p>
          <p><span className="text-muted">Bonne réponse:</span> {row.correctLabel}</p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-accent/10 flex items-end gap-2 flex-wrap">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Points</label>
          <input
            type="number" min="0" max={row.max} step="0.25" value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-24 bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Note (facultatif)</label>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full bg-bg/60 border border-accent/30 rounded px-2 py-1 text-white text-sm"
          />
        </div>
        <button type="button" disabled={saving} onClick={() => onSave(points, note)} className="btn-secondary text-xs">
          {saving ? 'Enregistrement…' : 'Enregistrer la note'}
        </button>
      </div>
    </div>
  );
}
