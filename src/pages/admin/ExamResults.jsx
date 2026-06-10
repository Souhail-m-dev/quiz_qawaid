import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import {
  downloadBlob,
  fetchAssetBase64,
  formatCertificateDate,
  generateCertificatePdfBlob,
  generateCertificatePngBlob,
  generateCertificatesZip,
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ExamResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [generatingZip, setGeneratingZip] = useState(false);
  const [bulkInfo, setBulkInfo] = useState(null);
  const [sendingMails, setSendingMails] = useState(false);
  const [mailInfo, setMailInfo] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: examData } = await supabase
        .from('exams')
        .select('id, title, slug, question_ids, certificate_min_score')
        .eq('id', id)
        .maybeSingle();
      setExam(examData);

      const { data: cands, error: candsErr } = await supabase
        .from('candidates')
        .select('id, full_name, email, telegram, created_at')
        .eq('exam_id', id)
        .order('created_at', { ascending: false });

      if (candsErr) {
        setError(candsErr.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: attempts, error: attemptsErr } = await supabase
        .from('attempts')
        .select('candidate_id, score, total, submitted_at, started_at')
        .eq('exam_id', id)
        .order('started_at', { ascending: false });

      const byCandidate = new Map();
      if (!attemptsErr && Array.isArray(attempts)) {
        for (const a of attempts) {
          if (!byCandidate.has(a.candidate_id)) byCandidate.set(a.candidate_id, a);
        }
      } else if (attemptsErr) {
        setError(attemptsErr.message);
      }

      const merged = (cands || []).map((c) => ({
        ...c,
        attempt: byCandidate.get(c.id) || null
      }));
      setRows(merged);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="text-muted p-10">Chargement…</p>;
  if (error) return <p className="text-incorrect p-10">{error}</p>;

  const selectedCount = selectedIds.length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const minScore = typeof exam?.certificate_min_score === 'number' ? exam.certificate_min_score : null;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : rows.map((r) => r.id));
  };

  const toggleSelectOne = (candidateId) => {
    setSelectedIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id_) => id_ !== candidateId) : [...prev, candidateId]
    );
  };

  const generateBulkCertificatesZip = async () => {
    if (!exam || selectedIds.length === 0) return;
    setGeneratingZip(true);
    setBulkInfo(null);
    try {
      const day = new Date().toISOString().slice(0, 10);
      const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
      const eligibleRows = selectedRows.filter((r) => isCertificateEligible(r.attempt, minScore));
      const skipped = selectedRows.length - eligibleRows.length;

      if (eligibleRows.length === 0) {
        if (minScore === null) {
          setBulkInfo("Aucun certificat généré: seuil certificat non configuré pour cet examen.");
        } else {
          setBulkInfo(`Aucun certificat généré: aucun candidat sélectionné n'est éligible (>= ${minScore}% et soumis).`);
        }
        return;
      }

      const zipEntries = [];
      for (const r of eligibleRows) {
        const baseName = `certificat-${sanitizeFileName(exam.slug)}-${sanitizeFileName(r.full_name)}-${day}`;
        const png = await generateCertificatePngBlob({
          studentName: r.full_name,
          dateLabel: formatCertificateDate(new Date(r.attempt.submitted_at))
        });
        const pdf = await generateCertificatePdfBlob({ pngBlob: png });
        zipEntries.push({ fileName: `${baseName}.png`, blob: png });
        zipEntries.push({ fileName: `${baseName}.pdf`, blob: pdf });
      }

      const zipBlob = await generateCertificatesZip(zipEntries);
      downloadBlob(zipBlob, `certificats-${sanitizeFileName(exam.slug)}-${day}.zip`);

      setBulkInfo(
        `ZIP généré: ${eligibleRows.length} candidat(s) inclus, ${skipped} exclu(s) (non soumis ou score < ${minScore}%).`
      );
    } catch (e) {
      setBulkInfo(e?.message || 'Échec de génération ZIP.');
    } finally {
      setGeneratingZip(false);
    }
  };

  const sendBulkCertificateEmails = async () => {
    if (!exam || selectedIds.length === 0) return;
    const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
    const eligibleRows = selectedRows.filter((r) => isCertificateEligible(r.attempt, minScore));
    const withEmail = eligibleRows.filter((r) => r.email && r.email.trim());
    const noEmail = eligibleRows.length - withEmail.length;
    const notEligible = selectedRows.length - eligibleRows.length;

    if (withEmail.length === 0) {
      setMailInfo(
        minScore === null
          ? 'Aucun envoi: seuil certificat non configuré sur cet examen.'
          : "Aucun envoi: aucun candidat sélectionné n'est éligible avec un email."
      );
      return;
    }

    if (!window.confirm(`Envoyer le certificat par email à ${withEmail.length} candidat(s) ?`)) return;

    setSendingMails(true);
    setMailInfo(null);
    let sent = 0;
    const failed = [];
    try {
      const day = new Date().toISOString().slice(0, 10);
      const logoBase64 = await fetchAssetBase64('/logo-email.png').catch(() => null);
      for (const r of withEmail) {
        try {
          const baseName = `certificat-${sanitizeFileName(exam.slug)}-${sanitizeFileName(r.full_name)}-${day}`;
          const png = await generateCertificatePngBlob({
            studentName: r.full_name,
            dateLabel: formatCertificateDate(new Date(r.attempt.submitted_at))
          });
          const pdf = await generateCertificatePdfBlob({ pngBlob: png });
          const pdfBase64 = await blobToBase64(pdf);
          const { error: fnError } = await supabase.functions.invoke('send-certificate', {
            body: {
              to: r.email,
              studentName: r.full_name,
              examTitle: exam.title,
              fileName: `${baseName}.pdf`,
              pdfBase64,
              score: r.attempt.score,
              total: r.attempt.total,
              logoBase64
            }
          });
          if (fnError) {
            let detail = fnError.message;
            try {
              const body = await fnError.context?.json?.();
              if (body?.error) detail = body.error;
            } catch { /* ignore */ }
            throw new Error(detail);
          }
          sent += 1;
          supabase.rpc('log_activity', {
            p_action: 'certificate_email',
            p_exam_id: id, p_candidate_id: r.id,
            p_meta: { to: r.email }
          });
        } catch (e) {
          failed.push(`${r.full_name} (${e?.message || 'erreur'})`);
        }
        await sleep(600);
      }
      const parts = [`${sent} email(s) envoyé(s)`];
      if (failed.length) parts.push(`${failed.length} échec(s): ${failed.join(', ')}`);
      if (noEmail) parts.push(`${noEmail} sans email`);
      if (notEligible) parts.push(`${notEligible} non éligible(s)`);
      setMailInfo(parts.join(' · '));
    } finally {
      setSendingMails(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="title-display text-2xl">{exam?.title || 'Résultats'}</h1>
          <p className="text-xs text-muted">/exam/{exam?.slug}</p>
        </div>
        <Link to="/admin" className="btn-secondary">← Retour</Link>
      </div>

      <div className="card mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <p className="text-white">{selectedCount} sélectionné(s)</p>
          <p className="text-xs text-muted">
            {minScore === null
              ? 'Certificat: seuil non configuré sur cet examen.'
              : `Certificat: tentative soumise + score >= ${minScore}%.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={toggleSelectAll}>
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={selectedCount === 0 || generatingZip || sendingMails || minScore === null}
            onClick={generateBulkCertificatesZip}
          >
            {generatingZip ? 'Génération ZIP…' : 'Générer certificats (ZIP)'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={selectedCount === 0 || generatingZip || sendingMails || minScore === null}
            onClick={sendBulkCertificateEmails}
          >
            {sendingMails ? 'Envoi des mails…' : 'Envoyer les certificats par email'}
          </button>
        </div>
      </div>
      {bulkInfo && <p className="text-xs text-muted mb-4">{bulkInfo}</p>}
      {mailInfo && <p className="text-xs text-muted mb-4">{mailInfo}</p>}

      {rows.length === 0 ? (
        <p className="text-muted italic">Aucun inscrit pour l'instant.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-accent/20 text-accent uppercase tracking-widest text-[10px]">
                <th className="py-2 pr-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Telegram</th>
                <th className="py-2 pr-3">Inscrit le</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Soumis le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {rows.map((r) => {
                const a = r.attempt;
                const submitted = a?.submitted_at;
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/admin/exams/${id}/results/${r.id}`)}
                    className="cursor-pointer hover:bg-accent/5"
                  >
                    <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelectOne(r.id)}
                      />
                    </td>
                    <td className="py-2 pr-3 text-white">{r.full_name}</td>
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3">{r.telegram}</td>
                    <td className="py-2 pr-3 text-muted">{formatDate(r.created_at)}</td>
                    <td className="py-2 pr-3">
                      {submitted
                        ? <span className="text-correct">Terminé</span>
                        : a ? <span className="text-moyenne">En cours</span> : <span className="text-muted">Non commencé</span>}
                    </td>
                    <td className="py-2 pr-3 font-bold">
                      {submitted ? `${fmtNum(a.score)}/${fmtNum(a.total)}` : '—'}
                    </td>
                    <td className="py-2 pr-3 text-muted">{formatDate(submitted)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
