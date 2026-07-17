'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

export function SigninForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus('error');
      setError('No pude enviar el magic-link. Revisa tu email y vuelve a intentar.');
      return;
    }

    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div role="status">
        <h2>Revisa tu correo</h2>
        <p>Te envie un enlace a {email}. Click ahi para entrar.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Iniciar sesion">
      <label htmlFor="email">Tu email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        disabled={status === 'sending'}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enviando...' : 'Enviar magic-link'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
