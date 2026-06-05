/** Tipos globales para probar NOVA sin micrófono. */
declare global {
  interface Window {
    /** En partida: `novaSay("misiles")`, `novaSay("escudo")`, etc. */
    novaSay?: (text: string) => void;
  }
}

export {};
