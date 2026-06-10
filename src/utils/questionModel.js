// Helpers de modèle de question, avec rétrocompat.
// Une question sans `type` = 'mcq'; sans `points` = 1.
import { gradeOpenAnswer } from './gradeOpen.js';

export function getType(q) {
  if (q?.type) return q.type;
  return Array.isArray(q?.options) ? 'mcq' : 'open';
}

export function getPoints(q) {
  return typeof q?.points === 'number' ? q.points : 1;
}

export function isOpen(q) {
  return getType(q) === 'open';
}

export function isChoice(q) {
  const t = getType(q);
  return t === 'mcq' || t === 'truefalse';
}

// Construit l'objet réponse stocké dans attempts.answers.
// input: { reponseChoisie?: number, reponseTexte?: string }
export function buildAnswer(question, input) {
  const points = getPoints(question);

  if (isChoice(question)) {
    const estCorrecte = input.reponseChoisie === question.reponseCorrecte;
    return {
      questionId: question.id,
      reponseChoisie: input.reponseChoisie,
      pointsObtenus: estCorrecte ? points : 0,
      pointsMax: points,
      estCorrecte,
      autoGraded: true,
      needsReview: false,
      rationale: null,
      correction: null
    };
  }

  // open
  const g = gradeOpenAnswer(question, input.reponseTexte);
  return {
    questionId: question.id,
    reponseTexte: input.reponseTexte ?? '',
    pointsObtenus: g.pointsObtenus,
    pointsMax: g.pointsMax,
    estCorrecte: g.pointsObtenus === g.pointsMax && g.pointsMax > 0,
    autoGraded: true,
    needsReview: g.needsReview,
    rationale: g.rationale,
    correction: null
  };
}

// Points effectifs d'une réponse: override correcteur prioritaire sinon auto.
export function effectivePoints(answer) {
  if (answer?.correction && typeof answer.correction.points === 'number') {
    return answer.correction.points;
  }
  return typeof answer?.pointsObtenus === 'number' ? answer.pointsObtenus : 0;
}

// Score total d'un tableau de réponses: { score, total }.
export function tallyScore(answers) {
  let score = 0;
  let total = 0;
  for (const a of answers || []) {
    score += effectivePoints(a);
    total += typeof a?.pointsMax === 'number' ? a.pointsMax : 1;
  }
  return { score: Math.round(score * 100) / 100, total: Math.round(total * 100) / 100 };
}
