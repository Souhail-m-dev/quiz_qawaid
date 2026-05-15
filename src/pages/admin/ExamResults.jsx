import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import {
  downloadBlob,
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
      const dateLabel = formatCertificateDate(new Date());
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
          dateLabel
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
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
            className="btn-primary"
            disabled={selectedCount === 0 || generatingZip || minScore === null}
            onClick={generateBulkCertificatesZip}
          >
            {generatingZip ? 'Génération ZIP…' : 'Générer certificats (ZIP)'}
          </button>
        </div>
      </div>
      {bulkInfo && <p className="text-xs text-muted mb-4">{bulkInfo}</p>}

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
                      {submitted ? `${a.score}/${a.total}` : '—'}
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
