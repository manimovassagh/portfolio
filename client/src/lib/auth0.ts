const trim = (value?: string | null) => value?.trim() || '';

export const auth0Config = {
  domain: trim(import.meta.env.VITE_AUTH0_DOMAIN),
  clientId: trim(import.meta.env.VITE_AUTH0_CLIENT_ID),
  audience: trim(import.meta.env.VITE_AUTH0_AUDIENCE),
  redirectUri: trim(import.meta.env.VITE_AUTH0_REDIRECT_URI) || window.location.origin,
  enabled: Boolean(trim(import.meta.env.VITE_AUTH0_DOMAIN) && trim(import.meta.env.VITE_AUTH0_CLIENT_ID) && trim(import.meta.env.VITE_AUTH0_AUDIENCE)),
};
export const auth0Scopes = 'openid profile email';
