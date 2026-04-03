'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const callbackUrl = params.get('callbackUrl') || '/';
    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false
    });
    setLoading(false);

    if (!result || result.error) {
      setError('Invalid credentials or inactive account.');
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  return (
    <div className="page" style={{ maxWidth: 520, margin: '24px auto' }}>
      <h2>Login</h2>
      <div className="note">Sign in with your AppBikeConfig email and password.</div>
      <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        {error ? <div style={{ color: '#b00020' }}>{error}</div> : null}
      </form>
    </div>
  );
}
