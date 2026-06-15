// Construit les lignes Question / Réponse de l'élève / Bonne réponse pour l'email.
import { getType, effectivePoints } from './questionModel.js';

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
