import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase.js';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [status, setStatus] = useState(null); // { valid, tenant_name, email, reason }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc('peek_invite', { p_token: token });
      if (e) setError(e.message);
      else setStatus(data);
      setLoading(false);
    })();
  }, [token]);

  const onSubmit = async ({ email, password }) => {
    setError(null);
    const mail = email.trim();
    // 1. Création du compte (confirmation email désactivée -> session immédiate).
    const { data: signUpData, error: suErr } = await supabase.auth.signUp({ email: mail, password });
    if (suErr) { setError(suErr.message); return; }

    // Email déjà enregistré: Supabase renvoie un user sans identités, sans erreur.
    const alreadyRegistered =
      signUpData.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0;

    let session = signUpData.session;
    if (!session) {
      // Soit le compte existe déjà, soit la confirmation email est activée.
      const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (siErr) {
        if (alreadyRegistered) {
          setError("Cet email a déjà un compte. Entrez son mot de passe (ou connectez-vous d’abord), puis rouvrez ce lien.");
        } else {
          setError("Connexion impossible après création : la confirmation par email est probablement activée sur le projet. Désactivez-la (Auth → Providers → Email) ou confirmez l’email. Détail : " + siErr.message);
        }
        return;
      }
      session = siData.session;
    }
    if (!session) {
      setError("Compte créé mais session absente (confirmation email requise).");
      return;
    }

    // 2. Échange du token -> rattachement correcteur.
    const { error: rdErr } = await supabase.rpc('redeem_invite', { p_token: token });
    if (rdErr) { setError(rdErr.message); return; }
    navigate('/admin', { replace: true });
  };

  if (loading) return <p className="text-muted p-10 text-center">Chargement…</p>;

  const reasonLabel = { introuvable: 'introuvable', 'utilisé': 'déjà utilisée', 'expiré': 'expirée' };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="title-display text-2xl mb-2 text-center">Invitation correcteur</h1>
      {status?.valid ? (
        <>
          <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-10">
            Rejoindre {status.tenant_name || 'l’instance'}
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-accent mb-2">Email</label>
              <input
                type="email"
                autoComplete="email"
                defaultValue={status.email || ''}
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
              {isSubmitting ? 'Création…' : 'Créer mon compte correcteur'}
            </button>
          </form>
        </>
      ) : (
        <div className="card text-center">
          <p className="text-incorrect">
            Invitation {reasonLabel[status?.reason] || 'invalide'}.
          </p>
          <p className="text-xs text-muted mt-2">Demandez un nouveau lien à l’administrateur de l’instance.</p>
        </div>
      )}
    </div>
  );
}
