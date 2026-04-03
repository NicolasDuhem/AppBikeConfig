'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      return;
    }

    window.location.href = result?.url || callbackUrl;
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ maxWidth: 420 }}>
      <div style={{ marginBottom: 12 }}>
        <label>Email</label>
        <input
          style={{ width: '100%' }}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Password</label>
        <input
          style={{ width: '100%' }}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <div style={{ color: 'red', marginBottom: 12 }}>{error}</div> : null}

      <button className="primary" type="submit">
        Login
      </button>
    </form>
  );
}
