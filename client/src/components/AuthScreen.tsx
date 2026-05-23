import { useEffect, useState } from 'react';
import { Apple, Fingerprint, KeyRound, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { getAuthProviders, loginInDevMode, loginWithApple, loginWithGoogle, loginWithPasskey, registerPasskey } from '../api';
import type { AuthProviders, AuthSession } from '../types';

type Provider = 'google' | 'apple' | 'passkey' | 'passkey-register' | 'dev';

export function AuthScreen({
  onAuthenticated,
  embedded = false,
  allowDevLogin = false,
}: {
  onAuthenticated: (session: AuthSession) => void;
  embedded?: boolean;
  allowDevLogin?: boolean;
}) {
  const [providers, setProviders] = useState<AuthProviders['providers'] | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [devUsername, setDevUsername] = useState('');

  useEffect(() => {
    getAuthProviders()
      .then((payload) => setProviders(payload.providers))
      .catch(() => setProviders({ google: false, apple: false, passkey: false }));
  }, []);

  const run = async (provider: Provider, devNameOverride?: string) => {
    if (provider === 'passkey-register' && !username.trim()) {
      setError('Enter a username to register a passkey');
      return;
    }
    setPending(provider);
    setError(null);
    try {
      const session = provider === 'google'
        ? await loginWithGoogle()
        : provider === 'apple'
          ? await loginWithApple()
          : provider === 'passkey'
            ? await loginWithPasskey()
            : provider === 'passkey-register'
              ? await registerPasskey(username.trim())
              : await loginInDevMode(devNameOverride ?? devUsername.trim());
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setPending(null);
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
            <p className="mt-1 text-sm font-semibold text-slate-500">Use a passwordless account to protect portfolio data.</p>
          </div>
        </div>

        <div className="space-y-2">
          <button className={buttonClass} disabled={!providers?.passkey || pending !== null} onClick={() => run('passkey')}>
            {pending === 'passkey' ? <Loader2 size={17} className="animate-spin" /> : <Fingerprint size={17} />}
            Sign in with passkey
          </button>
          {providers?.google && (
            <button className={buttonClass} disabled={pending !== null} onClick={() => run('google')}>
              {pending === 'google' ? <Loader2 size={17} className="animate-spin" /> : <span className="text-base">G</span>}
              Continue with Google
            </button>
          )}
          {providers?.apple && (
            <button className={buttonClass} disabled={pending !== null} onClick={() => run('apple')}>
              {pending === 'apple' ? <Loader2 size={17} className="animate-spin" /> : <Apple size={17} />}
              Continue with Apple
            </button>
          )}
        </div>

        {providers?.passkey && (
          <details className="mt-4 rounded-lg border border-slate-200 dark:border-[#3a3a3a]">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              <UserPlus size={14} className="inline mr-1.5" />Register new passkey
            </summary>
            <div className="flex gap-2 px-3 pb-3 pt-2">
              <input
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-slate-100"
                disabled={pending !== null}
              />
              <button
                className="rounded-md bg-[#45b9a8] px-3 py-2 text-sm font-black text-white hover:bg-[#3aa999] disabled:opacity-60"
                disabled={pending !== null || !username.trim()}
                onClick={() => run('passkey-register')}
              >
                {pending === 'passkey-register' ? <Loader2 size={15} className="animate-spin" /> : 'Register'}
              </button>
            </div>
          </details>
        )}

        {allowDevLogin && (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-[#3a3a3a]">
            <input
              type="text"
              placeholder="Local user name"
              value={devUsername}
              onChange={(e) => setDevUsername(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-slate-100"
              disabled={pending !== null}
            />
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#45b9a8] px-4 text-sm font-black text-white shadow-sm hover:bg-[#3aa999] disabled:opacity-60"
              disabled={pending !== null}
              onClick={() => run('dev', devUsername.trim())}
            >
              {pending === 'dev' ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
              Continue in local dev mode
            </button>
          </div>
        )}

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
