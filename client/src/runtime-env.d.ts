type KapitalRuntimeConfig = {
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0Audience?: string;
  auth0RedirectUri?: string;
};

declare global {
  interface Window {
    __KAPITAL_RUNTIME__?: KapitalRuntimeConfig;
  }
}

export {};
