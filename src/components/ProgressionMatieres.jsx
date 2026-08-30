import React from 'react';
import { Link } from 'react-router-dom';
import { groupProgress, EXAM_STATES } from '../utils/studentProgress.js';

// Progression d'un élève: matières → cours → examen (note / état).
// Partagé entre l'espace élève (/eleve) et la fiche admin (/admin/eleves/:id).
// `canTake` = affiche le lien pour passer un examen non commencé (côté élève).
export default function ProgressionMatieres({ rows, canTake = false, emptyLabel }) {
  const matieres = groupProgress(rows);

  if (matieres.length === 0) {
    return <p className="text-muted italic text-sm">{emptyLabel || 'Aucune matière pour le moment.'}</p>;
  }

  return (
    <div className="space-y-6">
      {matieres.map((m) => (
        <section key={m.id} className="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="font-display text-white uppercase text-sm tracking-wider">{m.name}</h2>
            <p className="text-[10px] text-muted uppercase tracking-widest">
              {m.stats.passed}/{m.stats.exams} examen(s)
              {m.stats.avgPct !== null && <span className="text-accent"> · moyenne {m.stats.avgPct}%</span>}
            </p>
          </div>

          {m.courses.length === 0 ? (
            <p className="text-muted italic text-xs">Aucun cours dans cette matière.</p>
          ) : (
            <ul className="divide-y divide-accent/10">
              {m.courses.map((c) => (
                <li key={c.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm text-white flex-1 min-w-[12rem]">
                    {c.number != null && <span className="text-muted mr-2">#{c.number}</span>}
                    {c.title}
                  </span>
                  {c.exams.length === 0 ? (
                    <span className="text-[10px] text-muted uppercase tracking-widest">Pas d'examen</span>
                  ) : (
                    c.exams.map((e) => <ExamCell key={e.id} exam={e} canTake={canTake} />)
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function ExamCell({ exam, canTake }) {
  if (exam.state === 'none') {
    return canTake ? (
      <Link to={`/exam/${exam.slug}`} className="btn-primary text-xs px-3 py-1.5">
        Passer l'examen
      </Link>
    ) : (
      <span className="text-[10px] text-muted uppercase tracking-widest">{EXAM_STATES.none}</span>
    );
  }
  if (exam.state === 'running') {
    return canTake ? (
      <Link to={`/exam/${exam.slug}/run`} className="text-xs text-accent underline">Reprendre</Link>
    ) : (
      <span className="text-[10px] text-muted uppercase tracking-widest">{EXAM_STATES.running}</span>
    );
  }
  const good = exam.pct !== null && exam.pct >= 50;
  return (
    <span className="flex items-center gap-2">
      <span className={`text-sm font-medium ${good ? 'text-correct' : 'text-incorrect'}`}>
        {exam.score ?? '—'}/{exam.total ?? '—'}
        {exam.pct !== null && <span className="text-muted text-xs ml-1">({exam.pct}%)</span>}
      </span>
      <span className="text-[10px] text-muted uppercase tracking-widest">{EXAM_STATES[exam.state]}</span>
    </span>
  );
}
