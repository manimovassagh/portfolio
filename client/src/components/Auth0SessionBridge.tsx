import { useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import type { AuthSession } from '../types';
import { exchangeAuth0Session } from '../api';
import { auth0Config, auth0Scopes } from '../lib/auth0';

export function Auth0SessionBridge({
  currentSession,
  onAuthenticated,
}: {
  currentSession: AuthSession | null;
  onAuthenticated: (session: AuthSession) => void;
}) {
  const { isAuthenticated, isLoading, user, getAccessTokenSilently } = useAuth0();
  const lastSubjectRef = useRef<string | null>(null);
  const subject = user?.sub ?? null;

  useEffect(() => {
    if (!auth0Config.enabled) return;
    if (isLoading) return;
    if (!isAuthenticated || !subject) {
      lastSubjectRef.current = null;
      return;
    }
    if (currentSession?.authenticated && currentSession.user?.provider === 'auth0') return;
    if (lastSubjectRef.current === subject) return;

    let mounted = true;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: auth0Config.audience,
            scope: auth0Scopes,
          },
        });
        const session = await exchangeAuth0Session(token);
        if (!mounted) return;
        lastSubjectRef.current = subject;
        onAuthenticated(session);
      } catch {
        if (mounted) {
          lastSubjectRef.current = null;
        }
      }
    })();

    return () => { mounted = false; };
  }, [currentSession?.authenticated, currentSession?.user?.provider, getAccessTokenSilently, isAuthenticated, isLoading, onAuthenticated, subject]);

  return null;
}
