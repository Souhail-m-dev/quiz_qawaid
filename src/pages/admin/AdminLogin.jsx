import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [error, setError] = useState(null);

  const onSubmit = async ({ email, password }) => {
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      return;
    }
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', data.user.id)
      .maybeSingle();
    const hasStaffAccess =
      profile?.role === 'owner' ||
      profile?.role === 'admin' ||
      profile?.role === 'correcteur' ||
      profile?.is_admin === true;
    if (pErr || !hasStaffAccess) {
      await supabase.auth.signOut();
      setError("Compte sans accès. Contactez l'administrateur de votre instance.");
      return;
    }
    const dest = location.state?.from || '/admin';
    navigate(dest, { replace: true });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="title-display text-2xl mb-2 text-center">Espace administrateur</h1>
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-10">Connexion requise</p>

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
      </form>
    </div>
  );
}
