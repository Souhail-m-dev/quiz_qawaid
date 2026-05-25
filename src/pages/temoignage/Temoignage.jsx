import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase.js';

export default function Temoignage() {
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm();

  const onSubmit = async (values) => {
    setError(null);
    const { error: e } = await supabase.from('temoignages').insert({
      name: values.name.trim(),
      review: values.review.trim()
    });
    if (e) {
      setError(e.message);
      return;
    }
    reset();
    setSent(true);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="mb-6">
        <Link to="/" className="text-xs text-accent uppercase tracking-[0.3em] hover:text-white transition">
          ← Accueil
        </Link>
      </div>

      <h1 className="title-display text-2xl mb-2 text-center">Témoignages</h1>
      <p className="text-xs text-muted uppercase tracking-[0.3em] text-center mb-8">
        Laissez votre avis
      </p>

      {sent ? (
        <div className="card text-center space-y-4">
          <p className="text-white">Merci pour votre témoignage.</p>
          <button type="button" onClick={() => setSent(false)} className="btn-primary w-full">
            Écrire un autre avis
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Nom</label>
            <input
              {...register('name', { required: 'Nom requis', minLength: { value: 2, message: 'Min. 2 caractères' } })}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none"
            />
            {errors.name && <p className="text-incorrect text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-accent mb-2">Témoignage</label>
            <textarea
              rows={5}
              {...register('review', { required: 'Témoignage requis', minLength: { value: 3, message: 'Min. 3 caractères' } })}
              className="w-full bg-bg/60 border border-accent/30 rounded px-3 py-2 text-white focus:border-accent outline-none resize-y"
            />
            {errors.review && <p className="text-incorrect text-xs mt-1">{errors.review.message}</p>}
          </div>
          {error && <p className="text-incorrect text-sm">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
      )}
    </div>
  );
}
