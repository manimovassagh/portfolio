import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { auth0Config, auth0Scopes } from '../lib/auth0';

export function Auth0LoginButton() {
  const { loginWithRedirect, isLoading, isAuthenticated } = useAuth0();
  const [pending, setPending] = useState(false);

  if (!auth0Config.enabled || isAuthenticated) {
    return null;
  }

  const handleClick = async () => {
    setPending(true);
    try {
      await loginWithRedirect({
        authorizationParams: {
          audience: auth0Config.audience,
          scope: auth0Scopes,
          redirect_uri: auth0Config.redirectUri,
        },
        appState: {
          returnTo: `${window.location.pathname}${window.location.search}`,
        },
      });
    } catch {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => { void handleClick(); }}
      disabled={pending || isLoading}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#45b9a8]/35 bg-[#45b9a8]/10 px-4 text-sm font-black text-[#45b9a8] shadow-sm transition hover:bg-[#45b9a8]/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#45b9a8]/30 dark:bg-[#45b9a8]/10"
    >
      <ShieldCheck size={17} />
      Continue with Auth0
    </button>
  );
}
