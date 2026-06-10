// Tests autonomes (sans framework): node src/utils/gradeOpen.test.mjs
import assert from 'node:assert/strict';
import { normalize, gradeOpenAnswer } from './gradeOpen.js';

let pass = 0;
const t = (name, fn) => { fn(); pass += 1; console.log('  ✓', name); };

// normalize
t('normalize: accents latins + ponctuation', () => {
  assert.equal(normalize('  Tawḥîd, al-ʿUlūhiyya! '), 'tawhid al uluhiyya');
});
t('normalize: tashkīl arabe retiré', () => {
  assert.equal(normalize('وَحَّدَ'), normalize('وحد'));
});
t('normalize: vide', () => assert.equal(normalize(null), ''));

// exact
t('exact: correspondance insensible casse/accents', () => {
  const q = { points: 1, grading: { mode: 'exact', acceptedAnswers: ['Non', 'pas de zakat'] } };
  assert.equal(gradeOpenAnswer(q, 'NON').pointsObtenus, 1);
  assert.equal(gradeOpenAnswer(q, 'Pas de Zakât').pointsObtenus, 1);
});
t('exact: aucune correspondance', () => {
  const q = { points: 1, grading: { mode: 'exact', acceptedAnswers: ['oui'] } };
  assert.equal(gradeOpenAnswer(q, 'peut-être').pointsObtenus, 0);
});
t('exact: réponse vide = 0 sans review', () => {
  const q = { points: 2, grading: { mode: 'exact', acceptedAnswers: ['x'] } };
  const r = gradeOpenAnswer(q, '   ');
  assert.equal(r.pointsObtenus, 0);
  assert.equal(r.needsReview, false);
});

// numeric
t('numeric: virgule décimale + tolérance', () => {
  const q = { points: 1, grading: { mode: 'numeric', expected: 1300, tolerance: 0 } };
  assert.equal(gradeOpenAnswer(q, 'environ 1300 €').pointsObtenus, 1);
  assert.equal(gradeOpenAnswer(q, '1 299,5').pointsObtenus, 0);
  const q2 = { points: 1, grading: { mode: 'numeric', expected: 1300, tolerance: 1 } };
  assert.equal(gradeOpenAnswer(q2, '1299,5').pointsObtenus, 1);
});

// keywords - somme
t('keywords: somme des points par groupe', () => {
  const q = { points: 1, grading: { mode: 'keywords', groups: [
    { any: ['khadija', 'خديجة'], points: 0.5 },
    { any: ['abu talib'], points: 0.5 }
  ] } };
  assert.equal(gradeOpenAnswer(q, 'Khadîja et la sortie à Taïf').pointsObtenus, 0.5);
  const full = gradeOpenAnswer(q, 'khadija et abu talib');
  assert.equal(full.pointsObtenus, 1);
  assert.equal(full.needsReview, false);
});
t('keywords: review si partiel', () => {
  const q = { points: 1, grading: { mode: 'keywords', groups: [
    { any: ['a'], points: 0.5 }, { any: ['b'], points: 0.5 }
  ] } };
  assert.equal(gradeOpenAnswer(q, 'a').needsReview, true);
});

// keywords - requireAtLeast (barème « N sur M »)
t('keywords: barème N sur M', () => {
  const q = { points: 1, grading: { mode: 'keywords', requireAtLeast: 2, groups: [
    { any: ['khadija'] }, { any: ['abu talib'] }, { any: ['taif'] }
  ] } };
  // 2 sur 3 attendus -> plein
  assert.equal(gradeOpenAnswer(q, 'khadija et abu talib').pointsObtenus, 1);
  // 1 sur 2 requis -> moitié
  assert.equal(gradeOpenAnswer(q, 'seulement khadija').pointsObtenus, 0.5);
});

console.log(`\n${pass} tests OK`);
