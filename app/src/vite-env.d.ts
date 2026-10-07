/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Sign-In client id (public). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** "prototipo": static demo build (GitHub Pages), no API. */
  readonly VITE_MODO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
