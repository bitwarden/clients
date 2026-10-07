/**
 * Contract for the per-sandbox Activity tab (agent-access-architecture.md, §M8.20 rule 18).
 *
 * The only real, sandbox-attributed events Desktop holds are the OpenShell credential-resolve rows
 * in the Agent Access activity buffer (§M8.8): which sandbox (gateway id), when, how many secrets
 * were asked for and whether the user allowed it. Nothing here carries a host, a program, a
 * provider or item name, or any value; those are not recorded, and must never be invented.
 */

/** How one resolve request ended. `pending` is still waiting for the user. */
export type OpenShellActivityOutcome = "allowed" | "denied" | "notFound" | "pending";

export interface OpenShellActivityEvent {
  /** Opaque row id from the activity buffer; stable, used only as a list key. */
  id: string;
  /** Unix epoch milliseconds the request arrived. */
  atMs: number;
  /** Attested name of the program that asked (the gateway binary), when known. */
  agentName: string | null;
  outcome: OpenShellActivityOutcome;
  /** How many secrets the request named. Never which. */
  secretCount: number;
}

export interface OpenShellListActivityRequest {
  /** Gateway-reported sandbox id (`OpenShellSandbox.id`). */
  sandboxId: string;
}

const SANDBOX_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function isOpenShellSandboxId(value: unknown): value is string {
  return typeof value === "string" && SANDBOX_ID.test(value);
}
