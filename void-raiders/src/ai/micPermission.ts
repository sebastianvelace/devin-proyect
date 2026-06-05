/** Permiso de micrófono compartido menú → partida (sessionStorage). */

const STORAGE_KEY = "void-raiders-mic-ready";

export function setMicReady(ready: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, ready ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function isMicReady(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Pide permiso si aún no se concedió en el menú. */
export async function ensureMicPermission(): Promise<boolean> {
  if (isMicReady()) return true;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    setMicReady(true);
    return true;
  } catch {
    setMicReady(false);
    return false;
  }
}
