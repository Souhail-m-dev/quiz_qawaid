import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/useAuth.js';
import ExamBrand from '../../components/ExamBrand.jsx';

// Connexion élève. L'espace admin (/admin/login) déconnecte les comptes non-staff:
// les élèves ont leur propre porte d'entrée, qui affiche l'état de validation.
export default function StudentLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, role, status, loading } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [error, setError] = useState(null);

  // Déjà connecté et validé: aller directement au tableau de bord.
  useEffect(() => {
    if (!loading && session && role === 'eleve' && status === 'approved') {
      navigate(location.state?.from || '/eleve', { replace: true });
    }
  }, [loading, session, role, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async ({ email, password }) => {
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); return; }

    const { data: me, error: meErr } = await supabase.rpc('student_me');
    if (meErr) { setError(meErr.message); return; }
    if (!me || me.role !== 'eleve') {
      await supabase.auth.signOut();
      setError("Ce compte n'est pas un compte élève. Utilisez l'espace administrateur.");
      return;
    }
    if (me.status === 'approved') { navigate(location.state?.from || '/eleve', { replace: true }); return; }
    // pending / rejected: la session reste ouverte, l'état est affiché ci-dessous.
    void data;
  };

  const pending = session && role === 'eleve' && status === 'pending';
  const rejected = session && role === 'eleve' && status === 'rejected';

  if (pending || rejected) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <ExamBrand />
        <div className="card text-center">
          {pending ? (
            <>
              <p className="text-accent font-display uppercase tracking-wider text-sm mb-3">Inscription en attente</p>
              <p className="text-sm text-muted leading-relaxed">
                Votre inscription n'a pas encore été validée par un responsable. Revenez plus tard.
              </p>
            </>
          ) : (
            <>
              <p className="text-incorrect font-display uppercase tracking-wider text-sm mb-3">Inscription refusée</p>
              <p className="text-sm text-muted leading-relaxed">
                Contactez le responsable de votre centre pour en connaître la raison.
              </p>
            </>
          )}
          <button
            onClick={async () => { await supabase.auth.signOut(); }}
            className="btn-primary mt-6"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <ExamBrand />
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-10">Espace élève</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Email</label>
          <input
            type="email"
            autoComplete="email"
            {...register('email', { required: 'Email requis' })}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.email && <p className="text-incorrect text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Mot de passe</label>
          <input
            type="password"
            autoComplete="current-password"
            {...register('password', { required: 'Mot de passe requis' })}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.password && <p className="text-incorrect text-xs mt-1">{errors.password.message}</p>}
        </div>
        {error && <p className="text-incorrect text-sm">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="text-xs text-muted text-center">
          Pas encore de compte ? <Link to="/eleve/inscription" className="text-accent underline">S'inscrire</Link>
        </p>
      </form>
    </div>
  );
}
