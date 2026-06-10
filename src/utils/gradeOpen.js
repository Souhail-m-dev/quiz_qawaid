// Correction déterministe (sans IA) des questions ouvertes.
// Trois modes: exact (réponses acceptées), numeric (nombre ± tolérance),
// keywords (groupes de mots-clés à crédit partiel).

// Normalise: minuscule, suppression diacritiques latins + tashkīl arabe,
// suppression ponctuation, espaces compactés.
export function normalize(input) {
  if (input == null) return '';
  return String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // diacritiques latins
    .replace(/[ً-ْٰ]/g, '')  // tashkīl arabe + alif khanjariyya
    .replace(/[\p{Lm}ʰ-˿‘’']/gu, '') // ʿ ʾ et lettres modificatrices (translit.)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')      // ponctuation -> espace
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrait le premier nombre (gère la virgule décimale française).
function firstNumber(text) {
  const m = String(text ?? '').replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return Number.parseFloat(m[0].replace(',', '.'));
}

function gradeExact(text, grading, points) {
  const norm = normalize(text);
  const accepted = (grading.acceptedAnswers || []).map(normalize).filter(Boolean);
  const ok = norm.length > 0 && accepted.includes(norm);
  return {
    pointsObtenus: ok ? points : 0,
    pointsMax: points,
    needsReview: false,
    rationale: ok ? 'Réponse acceptée (exact).' : 'Aucune correspondance exacte.'
  };
}

function gradeNumeric(text, grading, points) {
  const val = firstNumber(text);
  const expected = Number(grading.expected);
  const tol = Number(grading.tolerance) || 0;
  const ok = val != null && Number.isFinite(expected) && Math.abs(val - expected) <= tol;
  return {
    pointsObtenus: ok ? points : 0,
    pointsMax: points,
    needsReview: false,
    rationale: ok
      ? `Valeur ${val} acceptée (attendu ${expected}±${tol}).`
      : `Valeur ${val ?? '—'} hors tolérance (attendu ${expected}±${tol}).`
  };
}

function gradeKeywords(text, grading, points) {
  const norm = normalize(text);
  const groups = grading.groups || [];
  const matched = groups.filter((g) =>
    (g.any || []).some((kw) => {
      const n = normalize(kw);
      return n.length > 0 && norm.includes(n);
    })
  );

  let pointsObtenus;
  if (typeof grading.requireAtLeast === 'number') {
    // Barème « N sur M »: proportion des groupes attendus, cappé à points.
    const ratio = Math.min(matched.length / grading.requireAtLeast, 1);
    pointsObtenus = Math.round(ratio * points * 100) / 100;
  } else {
    // Somme des points par groupe matché.
    const sum = matched.reduce((acc, g) => acc + (Number(g.points) || 0), 0);
    pointsObtenus = Math.min(Math.round(sum * 100) / 100, points);
  }

  return {
    pointsObtenus,
    pointsMax: points,
    needsReview: pointsObtenus > 0 && pointsObtenus < points,
    rationale: `${matched.length}/${groups.length} groupe(s) de mots-clés reconnu(s).`
  };
}

// Note une réponse ouverte. `points` = barème de la question.
// Retourne {pointsObtenus, pointsMax, needsReview, rationale, autoGraded}.
export function gradeOpenAnswer(question, text) {
  const points = typeof question.points === 'number' ? question.points : 1;
  const grading = question.grading || {};
  const empty = !normalize(text);

  if (empty) {
    return { pointsObtenus: 0, pointsMax: points, needsReview: false, autoGraded: true, rationale: 'Réponse vide.' };
  }

  let res;
  switch (grading.mode) {
    case 'numeric': res = gradeNumeric(text, grading, points); break;
    case 'keywords': res = gradeKeywords(text, grading, points); break;
    case 'exact':
    default: res = gradeExact(text, grading, points); break;
  }
  return { ...res, autoGraded: true };
}
