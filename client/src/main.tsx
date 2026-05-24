import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';
import { auth0Config, auth0Scopes } from './lib/auth0';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function Auth0ProviderWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!auth0Config.enabled) {
    return children;
  }

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: auth0Config.redirectUri,
        audience: auth0Config.audience,
        scope: auth0Scopes,
      }}
      onRedirectCallback={(appState) => {
        const returnTo = appState?.returnTo || `${location.pathname}${location.search}`;
        navigate(returnTo, { replace: true });
      }}
    >
      {children}
    </Auth0Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Auth0ProviderWithRouter>
          <App />
        </Auth0ProviderWithRouter>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
