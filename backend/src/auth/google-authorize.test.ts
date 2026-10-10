import { describe, expect, it } from 'vitest';

import { appOriginFor, googleAuthorizeUrl, SIGN_IN_WINDOW_STATE } from './google-authorize.js';

describe('googleAuthorizeUrl', () => {
  const url = new URL(
    googleAuthorizeUrl({
      clientId: 'cliente.apps.googleusercontent.com',
      redirectUri: 'https://asistencia.example.com/api/v1/auth/google/redirect',
      nonce: 'nonce-de-prueba-1234567890',
    }),
  );

  it('va al servidor de Google por HTTPS', () => {
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
  });

  it('pide un ID token con el nonce, devuelto por formulario a nuestra dirección registrada', () => {
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'cliente.apps.googleusercontent.com',
      redirect_uri: 'https://asistencia.example.com/api/v1/auth/google/redirect',
      response_type: 'id_token',
      response_mode: 'form_post',
      scope: 'openid email profile',
      nonce: 'nonce-de-prueba-1234567890',
      state: SIGN_IN_WINDOW_STATE,
    });
  });

  it('nunca pide código de autorización ni acceso sin conexión (no hay client secret)', () => {
    expect(url.searchParams.get('response_type')).not.toContain('code');
    expect(url.searchParams.has('access_type')).toBe(false);
  });
});

describe('appOriginFor', () => {
  const origins = ['https://asistencia.example.com', 'https://otra.example.com'];

  it('usa el dominio de la petición cuando es uno de los nuestros', () => {
    expect(appOriginFor('otra.example.com', 'https', origins)).toBe('https://otra.example.com');
  });

  it('ignora un Host ajeno y usa el primer origen configurado', () => {
    expect(appOriginFor('malicioso.com', 'https', origins)).toBe('https://asistencia.example.com');
    expect(appOriginFor('asistencia.example.com', 'http', origins)).toBe(
      'https://asistencia.example.com',
    );
  });
});
