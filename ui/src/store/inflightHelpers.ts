import type { UIMode } from "../types";
import { getInflight } from "../lib/api";
import { normalizeInsertedPromptArray, type InsertedPrompt } from "./generationDefaults";
import { IN_FLIGHT_STORAGE_KEY } from "./persistenceRegistry";

export type PersistedInFlight = {
  id: string;
  prompt: string;
  startedAt: number;
  composerPrompt?: string;
  composerInsertedPrompts?: InsertedPrompt[];
  phase?: string;
  sessionId?: string | null;
  parentNodeId?: string | null;
  clientNodeId?: string | null;
  kind?: "classic" | "node" | "multimode" | "video";
};

export const INFLIGHT_TTL_MS = 180_000;

export type ServerInFlightJob = {
  requestId: string;
  kind?: string;
  prompt?: string;
  startedAt: number;
  phase?: string;
  meta?: Record<string, unknown>;
};

export type ServerTerminalJob = ServerInFlightJob & {
  status?: "completed" | "error" | "canceled";
  finishedAt?: number;
  durationMs?: number;
  httpStatus?: number;
  errorCode?: string;
};

export type InflightQueryScope = {
  kind: NonNullable<PersistedInFlight["kind"]>;
  sessionId?: string;
};

export function getInflightQueryScopes(state: {
  uiMode: UIMode;
  activeSessionId?: string | null;
  inFlight: PersistedInFlight[];
}): InflightQueryScope[] {
  const scopes: InflightQueryScope[] = state.uiMode === "node"
    ? [{ kind: "node", sessionId: state.activeSessionId ?? undefined }]
    : [{ kind: "classic" }];
  if (state.inFlight.some((job) => job.kind === "multimode")) {
    scopes.push({ kind: "multimode" });
  }
  scopes.push({ kind: "video" });
  return scopes;
}

export function matchesInflightScope(job: PersistedInFlight, scopes: InflightQueryScope[]): boolean {
  const kind = job.kind ?? "classic";
  return scopes.some((scope) =>
    kind === scope.kind &&
    (scope.kind !== "node" || (job.sessionId ?? null) === (scope.sessionId ?? null)),
  );
}

export async function fetchInflightScopes(scopes: InflightQueryScope[]): Promise<{
  jobs: ServerInFlightJob[];
  terminalJobs: ServerTerminalJob[];
}> {
  const responses = await Promise.all(scopes.map((scope) =>
    getInflight({
      kind: scope.kind,
      sessionId: scope.sessionId,
      includeTerminal: true,
    }),
  ));
  return {
    jobs: responses.flatMap((response) => response.jobs),
    terminalJobs: responses.flatMap((response) => response.terminalJobs ?? []) as ServerTerminalJob[],
  };
}

export function toPersistedInFlightJob(job: ServerInFlightJob): PersistedInFlight {
  const meta = job.meta ?? {};
  const kind =
    job.kind === "classic" || job.kind === "node" || job.kind === "multimode"
      ? job.kind
      : meta.kind === "classic" || meta.kind === "node" || meta.kind === "multimode"
        ? meta.kind
        : undefined;
  return {
    id: job.requestId,
    prompt: typeof job.prompt === "string" ? job.prompt : "",
    startedAt: job.startedAt,
    composerPrompt: typeof meta.composerPrompt === "string" ? meta.composerPrompt : undefined,
    composerInsertedPrompts: normalizeInsertedPromptArray(meta.composerInsertedPrompts) ?? undefined,
    phase: typeof job.phase === "string" ? job.phase : undefined,
    sessionId: typeof meta.sessionId === "string" ? meta.sessionId : null,
    parentNodeId: typeof meta.parentNodeId === "string" ? meta.parentNodeId : null,
    clientNodeId: typeof meta.clientNodeId === "string" ? meta.clientNodeId : null,
    kind,
  };
}

export function terminalJobError(job: ServerTerminalJob): Error & { code?: string; status?: number } {
  const code = typeof job.errorCode === "string" && job.errorCode
    ? job.errorCode
    : "UNKNOWN";
  const e = new Error(code === "EMPTY_RESPONSE"
    ? "No image data returned from the image backend."
    : "Generation failed on the server.") as Error & { code?: string; status?: number };
  e.code = code;
  e.status = typeof job.httpStatus === "number" ? job.httpStatus : undefined;
  return e;
}

export function isCanceledGenerationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const value = err as { code?: unknown; status?: unknown };
  return value.code === "GENERATION_CANCELED" || value.status === 499;
}

export function loadInFlight(): PersistedInFlight[] {
  try {
    const raw = localStorage.getItem(IN_FLIGHT_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr
      .filter(
        (x) =>
          x && typeof x.id === "string" && typeof x.prompt === "string" &&
          typeof x.startedAt === "number" && now - x.startedAt < INFLIGHT_TTL_MS,
      )
      .map((x) => ({
        id: x.id,
        prompt: x.prompt,
        startedAt: x.startedAt,
        composerPrompt: typeof x.composerPrompt === "string" ? x.composerPrompt : undefined,
        composerInsertedPrompts: normalizeInsertedPromptArray(x.composerInsertedPrompts) ?? undefined,
        phase: typeof x.phase === "string" ? x.phase : undefined,
        sessionId: typeof x.sessionId === "string" ? x.sessionId : null,
        parentNodeId: typeof x.parentNodeId === "string" ? x.parentNodeId : null,
        clientNodeId: typeof x.clientNodeId === "string" ? x.clientNodeId : null,
        kind: x.kind === "classic" || x.kind === "node" || x.kind === "multimode" || x.kind === "video" ? x.kind : undefined,
      }));
  } catch {
    return [];
  }
}

export function saveInFlight(list: PersistedInFlight[], onQuotaError?: () => void): void {
  try {
    localStorage.setItem(IN_FLIGHT_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    // Quota exceeded or storage disabled. Notify the user once per tab.
    const w = window as unknown as { __ima2QuotaWarned?: boolean };
    if (!w.__ima2QuotaWarned) {
      w.__ima2QuotaWarned = true;
      console.warn("[ima2] localStorage write failed:", err);
      if (onQuotaError) {
        try {
          onQuotaError();
        } catch {}
      }
    }
  }
}
