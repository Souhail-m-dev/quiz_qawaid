import React from 'react';

export default function Accueil({ meta, onChoisirComplet, onChoisirCours, coursDisponibles = [], onChoisirCoursDirect }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-14">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/15 text-accent mb-4 text-2xl">
          ٭
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-primary leading-tight">
          {meta.title}
        </h1>
        <p className="mt-2 text-muted text-sm sm:text-base">{meta.subtitle}</p>
        <p className="mt-1 text-xs text-muted/80">{meta.instructor}</p>
        <div className="ornament my-6" />
        <p className="text-sm text-ink/80">
          Bienvenue. Choisissez un mode pour commencer votre révision.
        </p>
      </div>

      <div className="grid gap-4">
        <button
          type="button"
          onClick={onChoisirComplet}
          className="card text-left hover:shadow-card transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-primary">Quiz complet</h2>
              <p className="text-sm text-muted mt-1">
                {meta.questionsPerQuiz} questions tirées au sort sur l'ensemble des cours
                ({meta.difficultyDistributionPerQuiz.facile} faciles,{' '}
                {meta.difficultyDistributionPerQuiz.moyenne} moyennes,{' '}
                {meta.difficultyDistributionPerQuiz.difficile} difficiles).
              </p>
            </div>
            <span className="text-accent text-2xl" aria-hidden>
              →
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onChoisirCours}
          className="card text-left hover:shadow-card transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-primary">Par cours</h2>
              <p className="text-sm text-muted mt-1">
                Choisissez un cours et révisez ses {meta.questionsPerCours} questions.
              </p>
            </div>
            <span className="text-accent text-2xl" aria-hidden>
              →
            </span>
          </div>
        </button>
      </div>

      {coursDisponibles.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg text-primary">Cours disponibles</h2>
            <span className="text-xs text-muted">{coursDisponibles.length} prêt{coursDisponibles.length > 1 ? 's' : ''}</span>
          </div>
          <ul className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:mx-0 sm:px-0">
            {coursDisponibles.map((c) => (
              <li key={c.id} className="snap-start shrink-0 w-64 sm:w-auto">
                <button
                  type="button"
                  onClick={() => onChoisirCoursDirect(c.id)}
                  aria-label={`Démarrer le quiz du cours ${c.id} : ${c.titre}`}
                  className="card text-left w-full h-full hover:shadow-card transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-accent font-semibold uppercase tracking-wide">
                      Cours {c.id}
                    </div>
                    <span className="text-[11px] text-muted bg-muted/10 rounded-full px-2 py-0.5 shrink-0">
                      {c.questions.length} q.
                    </span>
                  </div>
                  <div className="font-display text-base text-primary mt-2 leading-snug line-clamp-2">
                    {c.titre}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-muted mt-8">
        Aucune inscription, aucun suivi. Lancez et révisez librement.
      </p>
    </div>
  );
}
