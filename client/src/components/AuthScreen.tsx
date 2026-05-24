import { ShieldCheck } from 'lucide-react';
import type { AuthSession } from '../types';
import { Auth0LoginButton } from './Auth0LoginButton';

export function AuthScreen({
  embedded = false,
  accountHolderName,
  auth0Enabled = false,
  }: {
  onAuthenticated: (session: AuthSession) => void;
  embedded?: boolean;
  accountHolderName?: string | null;
  auth0Enabled?: boolean;
}) {
  const content = (
    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2b2b2b] dark:bg-[#242424]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#45b9a8] text-white">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight">Sign in to Kapital</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Continue with Auth0.
          </p>
          {accountHolderName && (
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
              Account holder: {accountHolderName}
            </p>
          )}
        </div>
      </div>

      {auth0Enabled ? (
        <Auth0LoginButton />
      ) : (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
          Auth0 is not configured for this environment yet.
        </div>
      )}
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
