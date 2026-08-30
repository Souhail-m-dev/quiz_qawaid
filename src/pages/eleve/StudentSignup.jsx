import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';
import ExamBrand from '../../components/ExamBrand.jsx';
import { TENANT_HOST } from '../../lib/tenantHost.js';

const HOST = TENANT_HOST;

// Inscription élève: compte Supabase Auth + register_student (statut 'pending').
// Même mécanique que InviteAccept (confirmation email désactivée sur le projet).
export default function StudentSignup() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // statut renvoyé par register_student

  const onSubmit = async ({ full_name, email, password }) => {
    setError(null);
    const mail = email.trim();

    const { data: signUpData, error: suErr } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { full_name: full_name.trim() } }
    });
    if (suErr) { setError(suErr.message); return; }

    // Email déjà enregistré: Supabase renvoie un user sans identités, sans erreur.
    const alreadyRegistered =
      signUpData.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0;

    let session = signUpData.session;
    if (!session) {
      const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (siErr) {
        setError(
          alreadyRegistered
            ? 'Cet email a déjà un compte. Connectez-vous avec son mot de passe.'
            : "Connexion impossible après création : la confirmation par email est probablement activée sur le projet. Détail : " + siErr.message
        );
        return;
      }
      session = siData.session;
    }
    if (!session) { setError('Compte créé mais session absente (confirmation email requise).'); return; }

    const { data, error: rsErr } = await supabase.rpc('register_student', { p_host: HOST });
    if (rsErr) { setError(rsErr.message); return; }
    if (data?.status === 'approved') { navigate('/eleve', { replace: true }); return; }
    setDone(data?.status || 'pending');
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <ExamBrand />
        <div className="card text-center">
          <p className="text-accent font-display uppercase tracking-wider text-sm mb-3">Inscription enregistrée</p>
          <p className="text-sm text-muted leading-relaxed">
            Votre demande a bien été transmise. Un responsable doit la valider avant que vous puissiez
            accéder aux examens. Reconnectez-vous plus tard pour vérifier.
          </p>
          <Link to="/eleve/login" className="btn-primary inline-block mt-6">Aller à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <ExamBrand />
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-10">Inscription élève</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent mb-2">Nom complet</label>
          <input
            type="text"
            autoComplete="name"
            {...register('full_name', { required: 'Nom requis', minLength: { value: 2, message: '2 caractères minimum' } })}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.full_name && <p className="text-incorrect text-xs mt-1">{errors.full_name.message}</p>}
        </div>
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
            autoComplete="new-password"
            {...register('password', { required: 'Mot de passe requis', minLength: { value: 6, message: '6 caractères minimum' } })}
            className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
          />
          {errors.password && <p className="text-incorrect text-xs mt-1">{errors.password.message}</p>}
        </div>
        {error && <p className="text-incorrect text-sm">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Création…' : "M'inscrire"}
        </button>
        <p className="text-xs text-muted text-center">
          Déjà inscrit ? <Link to="/eleve/login" className="text-accent underline">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
