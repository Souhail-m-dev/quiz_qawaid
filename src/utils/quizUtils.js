export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getAllQuestions(data) {
  return data.cours.flatMap((c) => c.questions);
}

export function getCoursById(data, coursId) {
  return data.cours.find((c) => c.id === coursId) || null;
}

export function selectQuestions(data, mode, coursId = null) {
  if (mode === 'cours') {
    const cours = getCoursById(data, coursId);
    if (!cours) return [];
    return shuffle(cours.questions);
  }

  const pool = getAllQuestions(data);
  const dist = data.meta?.difficultyDistributionPerQuiz ?? {
    facile: 10,
    moyenne: 10,
    difficile: 10
  };

  const pick = (level, count) =>
    shuffle(pool.filter((q) => q.difficulte === level)).slice(0, count);

  const faciles = pick('facile', dist.facile);
  const moyennes = pick('moyenne', dist.moyenne);
  const difficiles = pick('difficile', dist.difficile);

  return shuffle([...faciles, ...moyennes, ...difficiles]);
}

export function computeMention(score, total) {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 28 / 30) return { libelle: 'Excellent', sousTitre: "Qu'Allah vous bénisse", ton: 'success' };
  if (ratio >= 24 / 30) return { libelle: 'Très bien', sousTitre: 'Continuez sur cette voie', ton: 'success' };
  if (ratio >= 18 / 30) return { libelle: 'Bien', sousTitre: 'Bon niveau, à consolider', ton: 'info' };
  if (ratio >= 12 / 30) return { libelle: 'Passable', sousTitre: 'À retravailler', ton: 'warn' };
  return { libelle: 'Insuffisant', sousTitre: 'Révisez le cours', ton: 'danger' };
}

export function scoreParDifficulte(reponses, questions) {
  const buckets = { facile: { ok: 0, total: 0 }, moyenne: { ok: 0, total: 0 }, difficile: { ok: 0, total: 0 } };
  questions.forEach((q, idx) => {
    const r = reponses[idx];
    buckets[q.difficulte].total += 1;
    if (r?.estCorrecte) buckets[q.difficulte].ok += 1;
  });
  return buckets;
}
