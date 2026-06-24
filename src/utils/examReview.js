// Construit les lignes Question / Réponse de l'élève / Bonne réponse pour l'email.
import { getType, effectivePoints } from './questionModel.js';

// Clés de formulaire saines: exclut les clés dupliquées (bug collision historique,
// ex. les 6 champs `champ` de Miloud). Une clé qui n'apparaît qu'une fois = OK.
export function validFormKeys(schema) {
  const counts = {};
  for (const f of (Array.isArray(schema) ? schema : [])) counts[f.key] = (counts[f.key] || 0) + 1;
  return new Set(Object.keys(counts).filter((k) => counts[k] === 1));
}

// Lignes détaillées (1 par question) pour l'export CSV: réponse élève, bonne
// réponse, points effectifs (override correcteur prioritaire), max, correct?.
export function buildDetailRows(answers, questions) {
  const qById = new Map((Array.isArray(questions) ? questions : []).map((q) => [q.id, q]));
  return (Array.isArray(answers) ? answers : []).map((ans, idx) => {
    const q = qById.get(ans?.questionId) || {};
    const type = getType(q);
    const choice = type === 'mcq' || type === 'truefalse';
    const opts = Array.isArray(q.options) ? q.options : [];
    const your = choice ? (opts[ans?.reponseChoisie] ?? '—') : ((ans?.reponseTexte || '').trim() || '—');
    const correct = choice ? (opts[q.reponseCorrecte] ?? '—') : (q.modelAnswer || '—');
    const max = typeof ans?.pointsMax === 'number' ? ans.pointsMax : (typeof q.points === 'number' ? q.points : 1);
    const points = effectivePoints(ans);
    return {
      num: idx + 1,
      type: choice ? 'QCM' : 'Ouverte',
      question: q.question || ans?.questionId || '—',
      your, correct, points, max,
      ok: max > 0 && points >= max
    };
  });
}

export function buildReviewRows(answers, questions) {
  const qById = new Map((Array.isArray(questions) ? questions : []).map((q) => [q.id, q]));
  return (Array.isArray(answers) ? answers : []).map((ans) => {
    const q = qById.get(ans?.questionId) || {};
    const type = getType(q);
    let yours, correct;
    if (type === 'mcq' || type === 'truefalse') {
      const opts = Array.isArray(q.options) ? q.options : [];
      yours = opts[ans?.reponseChoisie] ?? '—';
      correct = opts[q.reponseCorrecte] ?? '—';
    } else {
      yours = (ans?.reponseTexte || '').trim() || '—';
      correct = q.modelAnswer || '—';
    }
    const max = typeof ans?.pointsMax === 'number' ? ans.pointsMax : 1;
    const ok = max > 0 && effectivePoints(ans) >= max;
    return { q: q.question || ans?.questionId || '—', your: yours, correct, ok };
  });
}
