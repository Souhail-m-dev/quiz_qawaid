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
import { certTemplateFor } from '../../config/certificateTemplates.js';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formField, setFormField] = useState('');
  const [formValue, setFormValue] = useState('');

  useEffect(() => {
    (async () => {
      let { data: examData } = await supabase
        .from('exams')
        .select('id, title, slug, tenant_id, question_ids, certificate_min_score, pre_form_schema, post_form_schema')
        .eq('id', id)
        .maybeSingle();
      if (!examData) {
        const fb = await supabase
          .from('exams')
          .select('id, title, slug, tenant_id, question_ids, certificate_min_score')
          .eq('id', id)
          .maybeSingle();
        examData = fb.data ? { ...fb.data, pre_form_schema: null, post_form_schema: null } : null;
      }
      setExam(examData);

      const { data: cands, error: candsErr } = await supabase
        .from('candidates')
        .select('id, full_name, email, telegram, created_at, pre_form_data, post_form_data')
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
        .select('candidate_id, score, total, submitted_at, started_at, graded_at')
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

  const minScore = typeof exam?.certificate_min_score === 'number' ? exam.certificate_min_score : null;
  const certTemplate = certTemplateFor(exam?.tenant_id); // null => instance sans certificat

  // Champs catégoriels filtrables: avant ET après examen (select / radio / checkbox).
  const CAT_TYPES = ['select', 'radio', 'checkbox'];
  const categoricalFields = [
    ...(exam?.pre_form_schema || []).filter((f) => CAT_TYPES.includes(f.type)).map((f) => ({ ...f, source: 'pre' })),
    ...(exam?.post_form_schema || []).filter((f) => CAT_TYPES.includes(f.type)).map((f) => ({ ...f, source: 'post', label: `${f.label} (après)` }))
  ];
  // Valeur affichable d'un champ (gère booléen et multi-cases).
  const getFormVal = (r, source, key) => {
    const v = (source === 'post' ? r.post_form_data : r.pre_form_data)?.[key];
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
    return v;
  };
  // formField encode "source:key".
  const [fSource, fKey] = formField ? formField.split(':') : [null, null];
  const fieldValues = fKey
    ? [...new Set(rows.map((r) => getFormVal(r, fSource, fKey)).filter((v) => v != null && v !== ''))]
    : [];

  const pctOf = (a) => (a?.submitted_at && a.total > 0 ? (a.score / a.total) * 100 : null);
  const matchesStatus = (r) => {
    const a = r.attempt; const submitted = !!a?.submitted_at; const pct = pctOf(a);
    switch (statusFilter) {
      case 'reussi': return submitted && minScore != null && pct != null && pct >= minScore;
      case 'echoue': return submitted && minScore != null && (pct == null || pct < minScore);
      case 'soumis': return submitted;
      case 'encours': return !!a && !submitted;
      case 'noncommence': return !a;
      default: return true;
    }
  };
  const q = search.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    if (q && !(`${r.full_name} ${r.email} ${r.telegram}`.toLowerCase().includes(q))) return false;
    if (!matchesStatus(r)) return false;
    if (formField && formValue && String(getFormVal(r, fSource, fKey) ?? '') !== String(formValue)) return false;
    return true;
  });

  const selectedCount = selectedIds.length;
  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filteredRows.map((r) => r.id));
  };

  const toggleSelectOne = (candidateId) => {
    setSelectedIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id_) => id_ !== candidateId) : [...prev, candidateId]
    );
  };

  const generateBulkCertificatesZip = async () => {
    if (!exam || selectedIds.length === 0) return;
    if (!certTemplate) {
      setBulkInfo("Cette instance n'émet pas de certificat.");
      return;
    }
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
          dateLabel: formatCertificateDate(new Date(r.attempt.submitted_at)),
          templateUrl: certTemplate
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
    const submittedRows = selectedRows.filter((r) => r.attempt?.submitted_at);
    // Avec certificat: seuls les éligibles. Sans certificat: tous les soumis (résultat).
    const targetRows = certTemplate
      ? submittedRows.filter((r) => isCertificateEligible(r.attempt, minScore))
      : submittedRows;
    const withEmail = targetRows.filter((r) => r.email && r.email.trim());
    const noEmail = targetRows.length - withEmail.length;
    const excluded = selectedRows.length - targetRows.length;

    if (withEmail.length === 0) {
      setMailInfo(
        certTemplate
          ? (minScore === null
              ? 'Aucun envoi: seuil certificat non configuré sur cet examen.'
              : "Aucun envoi: aucun candidat sélectionné n'est éligible avec un email.")
          : 'Aucun envoi: aucun candidat soumis avec un email.'
      );
      return;
    }

    const what = certTemplate ? 'le certificat' : 'le résultat';
    if (!window.confirm(`Envoyer ${what} par email à ${withEmail.length} candidat(s) ?`)) return;

    setSendingMails(true);
    setMailInfo(null);
    let sent = 0;
    const failed = [];
    try {
      const day = new Date().toISOString().slice(0, 10);
      for (const r of withEmail) {
        try {
          const body = {
            to: r.email,
            studentName: r.full_name,
            examId: exam.id,
            examTitle: exam.title,
            score: r.attempt.score,
            total: r.attempt.total
          };
          if (certTemplate) {
            const baseName = `certificat-${sanitizeFileName(exam.slug)}-${sanitizeFileName(r.full_name)}-${day}`;
            const png = await generateCertificatePngBlob({
              studentName: r.full_name,
              dateLabel: formatCertificateDate(new Date(r.attempt.submitted_at)),
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
          sent += 1;
          supabase.rpc('log_activity', {
            p_action: certTemplate ? 'certificate_email' : 'result_email',
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
      if (excluded) parts.push(`${excluded} exclu(s)`);
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
            {!certTemplate
              ? "Cette instance n'émet pas de certificat. Envoi du résultat par email."
              : minScore === null
                ? 'Certificat: seuil non configuré sur cet examen.'
                : `Certificat: tentative soumise + score >= ${minScore}%.`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-secondary" onClick={toggleSelectAll}>
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          {certTemplate && (
            <button
              type="button"
              className="btn-secondary"
              disabled={selectedCount === 0 || generatingZip || sendingMails || minScore === null}
              onClick={generateBulkCertificatesZip}
            >
              {generatingZip ? 'Génération ZIP…' : 'Générer certificats (ZIP)'}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={selectedCount === 0 || generatingZip || sendingMails}
            onClick={sendBulkCertificateEmails}
          >
            {sendingMails
              ? 'Envoi des mails…'
              : (certTemplate ? 'Envoyer les certificats par email' : 'Envoyer les résultats par email')}
          </button>
        </div>
      </div>
      {bulkInfo && <p className="text-xs text-muted mb-4">{bulkInfo}</p>}
      {mailInfo && <p className="text-xs text-muted mb-4">{mailInfo}</p>}

      {rows.length > 0 && (
        <div className="card mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Recherche</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, email, telegram…"
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white text-sm focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none"
            >
              <option value="">Tous</option>
              <option value="reussi">Réussi</option>
              <option value="echoue">Échoué</option>
              <option value="soumis">Soumis</option>
              <option value="encours">En cours</option>
              <option value="noncommence">Non commencé</option>
            </select>
          </div>
          {categoricalFields.length > 0 && (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Champ formulaire</label>
                <select
                  value={formField}
                  onChange={(e) => { setFormField(e.target.value); setFormValue(''); }}
                  className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none"
                >
                  <option value="">—</option>
                  {categoricalFields.map((f) => {
                    const v = `${f.source}:${f.key}`;
                    return <option key={v} value={v}>{f.label}</option>;
                  })}
                </select>
              </div>
              {formField && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-accent mb-1">Valeur</label>
                  <select
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="bg-bg/60 border border-accent/30 rounded px-2 py-2 text-white text-sm focus:border-accent outline-none"
                  >
                    <option value="">Toutes</option>
                    {fieldValues.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          {(search || statusFilter || formField) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setSearch(''); setStatusFilter(''); setFormField(''); setFormValue(''); }}
            >
              Réinitialiser
            </button>
          )}
          <p className="text-xs text-muted ml-auto self-center">{filteredRows.length} / {rows.length} affiché(s)</p>
        </div>
      )}

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
              {filteredRows.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-muted italic">Aucun résultat pour ces filtres.</td></tr>
              )}
              {filteredRows.map((r) => {
                const a = r.attempt;
                const submitted = a?.submitted_at;
                const pct = pctOf(a);
                // Réussi/échoué connu uniquement si soumis + seuil configuré.
                const passed = submitted && minScore != null && pct != null ? pct >= minScore : null;
                const edge = passed === true ? 'border-l-correct' : passed === false ? 'border-l-incorrect' : 'border-l-transparent';
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/admin/exams/${id}/results/${r.id}`)}
                    className={`cursor-pointer hover:bg-accent/5 border-l-2 ${edge}`}
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
                      {a?.graded_at && (
                        <span className="ml-2 text-[9px] uppercase px-2 py-0.5 rounded bg-accent/20 text-accent">corrigé</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-bold">
                      {submitted ? (
                        <span className={passed === true ? 'text-correct' : passed === false ? 'text-incorrect' : ''}>
                          {fmtNum(a.score)}/{fmtNum(a.total)}
                          {passed !== null && (
                            <span className="ml-1.5 text-[10px]" title={passed ? 'Réussi' : 'Échoué'}>{passed ? '✓' : '✗'}</span>
                          )}
                        </span>
                      ) : '—'}
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
