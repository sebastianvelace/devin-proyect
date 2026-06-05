/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  /** Set to "true" to force /api/anthropic proxy in local dev */
  readonly VITE_USE_ANTHROPIC_PROXY?: string;
}

interface ImportMetaEnvReadonly extends ImportMetaEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnvReadonly;
}
