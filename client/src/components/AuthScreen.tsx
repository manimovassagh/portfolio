import { useState } from 'react';
import { Loader2, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react';
import { loginWithEmail, registerWithEmail } from '../api';
import type { AuthSession } from '../types';
import { Auth0LoginButton } from './Auth0LoginButton';

type Mode = 'login' | 'register';

export function AuthScreen({
  onAuthenticated,
  embedded = false,
  accountHolderName,
  auth0Enabled = false,
}: {
  onAuthenticated: (session: AuthSession) => void;
  embedded?: boolean;
  accountHolderName?: string | null;
  auth0Enabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const session = mode === 'register'
        ? await registerWithEmail(email.trim(), password, name.trim() || undefined)
        : await loginWithEmail(email.trim(), password);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setPending(false);
    }
  };

  const buttonClass = 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-100 dark:hover:bg-[#383838]';

  const content = (
    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2b2b2b] dark:bg-[#242424]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#45b9a8] text-white">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight">Sign in to Kapital</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {auth0Enabled ? 'Continue with Auth0 or use an email and password.' : 'Use an email and password.'}
          </p>
          {accountHolderName && (
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
              Account holder: {accountHolderName}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-1 dark:border-[#3a3a3a]">
        <button
          type="button"
          className={`h-10 rounded-md text-sm font-black transition ${mode === 'login' ? 'bg-[#45b9a8] text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          onClick={() => setMode('login')}
          disabled={pending}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`h-10 rounded-md text-sm font-black transition ${mode === 'register' ? 'bg-[#45b9a8] text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          onClick={() => setMode('register')}
          disabled={pending}
        >
          Create account
        </button>
      </div>

      {auth0Enabled && (
        <div className="mb-4">
          <Auth0LoginButton />
        </div>
      )}

      {mode === 'register' && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-slate-100"
            disabled={pending}
          />
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-slate-100"
          disabled={pending}
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-slate-100"
          disabled={pending}
        />
      </div>

      <button
        className={buttonClass}
        disabled={pending || !email.trim() || (mode === 'register' ? password.length < 8 : password.length === 0)}
        onClick={submit}
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : mode === 'register' ? <UserPlus size={17} /> : <LockKeyhole size={17} />}
        {mode === 'register' ? 'Create account' : 'Sign in'}
      </button>

      {error && <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-500">{error}</div>}
    </section>
  );

  if (embedded) {
    return <div className="flex justify-center py-12">{content}</div>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 text-slate-950 dark:bg-black dark:text-slate-100">
      {content}
    </main>
  );
}
