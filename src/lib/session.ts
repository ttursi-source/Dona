import { useSyncExternalStore } from "react";
import { hashCode } from "./access";
import { getRawState } from "./store";
import type { DonaSession } from "./types";

export const SESSION_KEY = "dona:session";

function loadSession(): DonaSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DonaSession>;
    if (
      (parsed.role === "sede" || parsed.role === "central") &&
      typeof parsed.orgId === "string" &&
      typeof parsed.token === "string"
    ) {
      return {
        role: parsed.role,
        orgId: parsed.orgId,
        sedeId: parsed.sedeId,
        token: parsed.token,
      };
    }
    return null;
  } catch {
    return null;
  }
}

let currentSession: DonaSession | null = loadSession();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getSession(): DonaSession | null {
  return currentSession;
}

export function reloadSessionFromStorage(): DonaSession | null {
  currentSession = loadSession();
  notify();
  return currentSession;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSession(): DonaSession | null {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}

export function signIn(session: DonaSession): DonaSession {
  currentSession = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage quota errors for tiny session token
  }
  notify();
  return session;
}

export function signOut(): void {
  currentSession = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function hasAccessToSede(
  session: DonaSession | null,
  orgId: string,
  sedeId: string
): boolean {
  if (!session || session.orgId !== orgId) return false;
  if (session.role === "central") return true;
  return session.role === "sede" && session.sedeId === sedeId;
}

export function hasAccessToCentral(session: DonaSession | null, orgId: string): boolean {
  return Boolean(session && session.role === "central" && session.orgId === orgId);
}

export async function loginLocal(
  role: "sede" | "central",
  orgId: string,
  sedeId: string | undefined,
  code: string
): Promise<{ ok: boolean; session?: DonaSession; error?: string }> {
  const raw = getRawState();

  if (role === "central") {
    const org = raw.orgs.find((o) => o.id === orgId && !o.deleted);
    if (!org) return { ok: false, error: "Organización no encontrada." };
    const candidate = await hashCode(org.id, code);
    if (!org.codeHash || org.codeHash !== candidate) {
      return { ok: false, error: "Código incorrecto para Sede Central." };
    }
    const session = signIn({ role: "central", orgId: org.id, token: candidate });
    return { ok: true, session };
  }

  const sede = raw.sedes.find(
    (s) => s.id === sedeId && s.orgId === orgId && !s.deleted
  );
  if (!sede) return { ok: false, error: "Sede no encontrada." };
  if (sede.active === false) {
    return { ok: false, error: "Esta sede fue dada de baja por Sede Central." };
  }
  const candidate = await hashCode(sede.id, code);
  if (!sede.codeHash || sede.codeHash !== candidate) {
    return { ok: false, error: "Código incorrecto para esta sede." };
  }
  const session = signIn({ role: "sede", orgId, sedeId: sede.id, token: candidate });
  return { ok: true, session };
}
