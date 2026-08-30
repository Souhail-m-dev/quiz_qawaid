// Tests autonomes (sans framework): node src/utils/studentProgress.test.mjs
import assert from 'node:assert/strict';
import { groupProgress, examState, pct } from './studentProgress.js';

let pass = 0;
const t = (name, fn) => { fn(); pass += 1; console.log('  ✓', name); };

const row = (o) => ({
  matiere_id: 'm1', matiere_name: 'Hisnul Mouslim',
  course_id: null, course_number: null, course_title: null,
  exam_id: null, exam_slug: null, exam_title: null,
  candidate_id: null, score: null, total: null,
  started_at: null, submitted_at: null, graded_at: null, answers: null,
  ...o
});

t('examState: les 4 états', () => {
  assert.equal(examState(row({})), 'none');
  assert.equal(examState(row({ candidate_id: 'c1' })), 'running');
  assert.equal(examState(row({ candidate_id: 'c1', submitted_at: 'x' })), 'done');
  assert.equal(examState(row({ candidate_id: 'c1', submitted_at: 'x', graded_at: 'y' })), 'graded');
});

t('pct: division par zéro et null', () => {
  assert.equal(pct(8, 10), 80);
  assert.equal(pct(0, 0), null);
  assert.equal(pct(5, null), null);
});

t('matière sans cours: présente, 0 cours', () => {
  const [m] = groupProgress([row({})]);
  assert.equal(m.name, 'Hisnul Mouslim');
  assert.deepEqual(m.courses, []);
  assert.deepEqual(m.stats, { courses: 0, exams: 0, passed: 0, avgPct: null });
});

t('cours sans examen: cours listé, aucun examen', () => {
  const [m] = groupProgress([row({ course_id: 'c1', course_number: 1, course_title: 'Cours 1' })]);
  assert.equal(m.courses.length, 1);
  assert.equal(m.courses[0].title, 'Cours 1');
  assert.deepEqual(m.courses[0].exams, []);
  assert.equal(m.stats.exams, 0);
});

t('examen non passé: état none, pas compté comme passé', () => {
  const [m] = groupProgress([
    row({ course_id: 'c1', course_number: 1, course_title: 'Cours 1', exam_id: 'e1', exam_slug: 'ex-1', exam_title: 'Examen 1' })
  ]);
  assert.equal(m.courses[0].exams[0].state, 'none');
  assert.equal(m.stats.exams, 1);
  assert.equal(m.stats.passed, 0);
  assert.equal(m.stats.avgPct, null);
});

t('examen en cours: pas de note, pas dans la moyenne', () => {
  const [m] = groupProgress([
    row({ course_id: 'c1', exam_id: 'e1', candidate_id: 'cand1' })
  ]);
  assert.equal(m.courses[0].exams[0].state, 'running');
  assert.equal(m.stats.passed, 0);
});

t('examens notés: regroupement + moyenne', () => {
  const rows = [
    row({ course_id: 'c1', course_number: 1, course_title: 'Cours 1', exam_id: 'e1', exam_slug: 'ex-1', exam_title: 'Examen 1',
          candidate_id: 'cand1', score: 8, total: 10, submitted_at: 'x', graded_at: 'y' }),
    row({ course_id: 'c2', course_number: 2, course_title: 'Cours 2', exam_id: 'e2', exam_slug: 'ex-2', exam_title: 'Examen 2',
          candidate_id: 'cand2', score: 6, total: 10, submitted_at: 'x' }),
    row({ course_id: 'c3', course_number: 3, course_title: 'Cours 3' })
  ];
  const [m] = groupProgress(rows);
  assert.equal(m.courses.length, 3);
  assert.equal(m.courses[0].exams[0].pct, 80);
  assert.equal(m.courses[0].exams[0].state, 'graded');
  assert.equal(m.courses[1].exams[0].state, 'done');
  assert.deepEqual(m.stats, { courses: 3, exams: 2, passed: 2, avgPct: 70 });
});

t('deux matières: ordre des lignes préservé, pas de fusion', () => {
  const ms = groupProgress([
    row({ course_id: 'c1', exam_id: 'e1' }),
    row({ matiere_id: 'm2', matiere_name: 'Qawaid', course_id: 'c9', exam_id: 'e9' }),
    row({ course_id: 'c1', exam_id: 'e2' })
  ]);
  assert.deepEqual(ms.map((m) => m.name), ['Hisnul Mouslim', 'Qawaid']);
  assert.equal(ms[0].courses.length, 1);
  assert.equal(ms[0].courses[0].exams.length, 2);
});

t('entrée vide / null', () => {
  assert.deepEqual(groupProgress([]), []);
  assert.deepEqual(groupProgress(null), []);
});

console.log(`\n${pass} tests OK`);
