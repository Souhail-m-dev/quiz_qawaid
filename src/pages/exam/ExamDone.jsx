import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

const lsKey = (slug) => `examCandidate:${slug}`;

export default function ExamDone() {
  const { slug } = useParams();

  useEffect(() => {
    localStorage.removeItem(lsKey(slug));
  }, [slug]);

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="card">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-correct/20 flex items-center justify-center text-correct text-3xl">✓</div>
        <h1 className="title-display text-2xl mb-3">Examen soumis</h1>
        <p className="text-sm text-white/80 leading-relaxed mb-2">
          Merci d'avoir passé l'examen.
        </p>
        <p className="text-sm text-muted leading-relaxed mb-6">
          Vos résultats vous seront communiqués prochainement par l'administrateur.
        </p>
        <Link to="/" className="btn-secondary inline-block">Retour à l'accueil</Link>
      </div>
    </div>
  );
}
