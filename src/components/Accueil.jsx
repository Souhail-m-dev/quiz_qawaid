import React from 'react';

export default function Accueil({ meta, onChoisirComplet, onChoisirCours, coursDisponibles = [], onChoisirCoursDirect }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-14">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-10">
          <div className="relative group">
            {/* Elegant outer glow */}
            <div className="absolute -inset-4 bg-accent/10 rounded-full blur-xl group-hover:bg-accent/20 transition duration-1000"></div>
            
            {/* Logo Container */}
            <div className="relative bg-beige p-1 rounded-full shadow-2xl border-2 border-accent/30 overflow-hidden w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Logo Al-Qawa'id Al-Muthla" 
                className="w-full h-full object-cover scale-110 sepia-[.3] hue-rotate-[10deg] brightness-[1.1]"
              />
            </div>
            
            {/* Decorative element below */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-[2px] bg-gradient-to-r from-transparent via-accent/40 to-transparent"></div>
          </div>
        </div>
        
        <h1 className="title-display text-2xl sm:text-4xl mb-4">
          {meta.title}
        </h1>
        <p className="font-display text-accent/80 text-sm sm:text-lg tracking-widest uppercase mb-2">
          {meta.subtitle}
        </p>
        <p className="text-xs text-muted tracking-widest uppercase italic">{meta.instructor}</p>
        
        <div className="ornament-border mt-8 mb-6" />
        
        <p className="text-sm text-white/70 italic max-w-md mx-auto">
          "L'étude des règles et des principes dans les Noms et Attributs d'Allah"
        </p>
      </div>

      <div className="grid gap-6">
        <button
          type="button"
          onClick={onChoisirComplet}
          className="card text-left hover:border-accent/60 transition duration-500 group"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="title-display text-lg group-hover:text-white transition">Quiz complet</h2>
              <p className="text-sm text-muted mt-2 group-hover:text-muted/80">
                {meta.questionsPerQuiz} questions tirées au sort sur l'ensemble des cours.
              </p>
            </div>
            <div className="w-10 h-10 rounded-full border border-accent/30 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-bg transition duration-500">
              <span className="text-xl" aria-hidden>→</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onChoisirCours}
          className="card text-left hover:border-accent/60 transition duration-500 group"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="title-display text-lg group-hover:text-white transition">Par cours</h2>
              <p className="text-sm text-muted mt-2 group-hover:text-muted/80">
                Choisissez un cours spécifique et révisez ses notions.
              </p>
            </div>
            <div className="w-10 h-10 rounded-full border border-accent/30 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-bg transition duration-500">
              <span className="text-xl" aria-hidden>→</span>
            </div>
          </div>
        </button>
      </div>

      {coursDisponibles.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-4 px-1">
            <h2 className="title-display text-sm tracking-[0.3em]">Cours disponibles</h2>
            <span className="text-[10px] text-accent tracking-tighter uppercase">{coursDisponibles.length} Unités</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coursDisponibles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChoisirCoursDirect(c.id)}
                className="card p-4 !bg-surface/40 hover:!bg-surface/60 border-accent/10 hover:border-accent/40 transition duration-300 text-left group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">Cours {c.id}</span>
                  <span className="text-[9px] text-muted uppercase tracking-widest">{c.questions.length} questions</span>
                </div>
                <div className="font-display text-white group-hover:text-accent transition leading-snug line-clamp-2 uppercase text-sm tracking-wider">
                  {c.titre}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
