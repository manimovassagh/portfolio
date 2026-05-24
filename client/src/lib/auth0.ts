const trim = (value?: string | null) => value?.trim() || '';

const runtime = window.__KAPITAL_RUNTIME__ || {};
const domain = trim(runtime.auth0Domain) || trim(import.meta.env.VITE_AUTH0_DOMAIN);
const clientId = trim(runtime.auth0ClientId) || trim(import.meta.env.VITE_AUTH0_CLIENT_ID);
const audience = trim(runtime.auth0Audience) || trim(import.meta.env.VITE_AUTH0_AUDIENCE);
const redirectUri = trim(runtime.auth0RedirectUri) || trim(import.meta.env.VITE_AUTH0_REDIRECT_URI) || window.location.origin;

export const auth0Config = {
  domain,
  clientId,
  audience,
  redirectUri,
  enabled: Boolean(domain && clientId && audience),
};
export const auth0Scopes = 'openid profile email';
