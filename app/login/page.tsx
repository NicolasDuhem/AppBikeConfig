import { Suspense } from 'react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <div className="page">
      <h2>Login</h2>
      <div className="note">Sign in to access AppBikeConfig.</div>

      <Suspense fallback={<div className="card">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
