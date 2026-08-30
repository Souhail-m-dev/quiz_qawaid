// Regroupement des lignes plates renvoyées par le RPC student_progress
// (une ligne par examen des matières où l'élève est inscrit) en
// matières → cours → examens, avec l'état de chaque copie.

export const EXAM_STATES = {
  none: 'Non passé',
  running: 'En cours',
  done: 'Passé',
  graded: 'Corrigé'
};

export function examState(row) {
  if (!row.candidate_id) return 'none';
  if (!row.submitted_at) return 'running';
  return row.graded_at ? 'graded' : 'done';
}

export function pct(score, total) {
  if (total === null || total === undefined || Number(total) === 0) return null;
  return Math.round((Number(score) / Number(total)) * 1000) / 10;
}

// rows -> [{ id, name, courses: [{ id, number, title, exams: [...] }], stats }]
// L'ordre des lignes est déjà celui du RPC: on le préserve.
export function groupProgress(rows) {
  const matieres = [];
  const byMatiere = new Map();
  const byCourse = new Map();

  for (const r of rows || []) {
    let m = byMatiere.get(r.matiere_id);
    if (!m) {
      m = { id: r.matiere_id, name: r.matiere_name, courses: [] };
      byMatiere.set(r.matiere_id, m);
      matieres.push(m);
    }
    if (!r.course_id) continue; // matière sans cours

    const ckey = `${r.matiere_id}:${r.course_id}`;
    let c = byCourse.get(ckey);
    if (!c) {
      c = { id: r.course_id, number: r.course_number, title: r.course_title, exams: [] };
      byCourse.set(ckey, c);
      m.courses.push(c);
    }
    if (!r.exam_id) continue; // cours sans examen rattaché

    c.exams.push({
      id: r.exam_id,
      slug: r.exam_slug,
      title: r.exam_title,
      candidateId: r.candidate_id,
      score: r.score,
      total: r.total,
      pct: pct(r.score, r.total),
      submittedAt: r.submitted_at,
      gradedAt: r.graded_at,
      answers: r.answers,
      state: examState(r)
    });
  }

  for (const m of matieres) {
    const exams = m.courses.flatMap((c) => c.exams);
    const passed = exams.filter((e) => e.state === 'done' || e.state === 'graded');
    const scored = passed.filter((e) => e.pct !== null);
    m.stats = {
      courses: m.courses.length,
      exams: exams.length,
      passed: passed.length,
      avgPct: scored.length
        ? Math.round((scored.reduce((s, e) => s + e.pct, 0) / scored.length) * 10) / 10
        : null
    };
  }
  return matieres;
}
