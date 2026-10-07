/**
 * Contract for opening a shell in a sandbox and for its port forwards (agent-access-architecture.md,
 * §M8.20 rule 15). Plain data and pure validators, importable from main and renderer. Ports and
 * display names only: nothing here holds a credential value.
 */

import { isOpenShellPort } from "./openshell-management";

/** At most this many saved ports per gateway and sandbox. */
export const OPENSHELL_MAX_SAVED_PORTS = 20;
/** A friendly name ("Web vault", "API") is capped to this many characters. */
export const OPENSHELL_MAX_PORT_NAME_CHARS = 40;

/**
 * A port forward the CLI is tracking. `bindAddress` is reported by the CLI (`""` when it doesn't
 * say), shown as text only. `pid` is informational and never used to signal anything.
 */
export interface OpenShellForward {
  sandboxName: string;
  port: number;
  bindAddress: string;
  pid: number | null;
}

export interface OpenShellListForwardsRequest {
  sandboxName: string;
}

/**
 * `openshell forward start --background 127.0.0.1:<port> <sandbox>`. The CLI forwards the same
 * port number locally and in the sandbox, and the bind address is always loopback: there is no
 * field for either a different target port or a wider bind address.
 */
export interface OpenShellStartForwardRequest {
  sandboxName: string;
  port: number;
}

export interface OpenShellStopForwardRequest {
  sandboxName: string;
  port: number;
}

/** `copyCommand` only builds the text; `openTerminal` launches Terminal (macOS only). */
export type OpenShellShellAction = "copyCommand" | "openTerminal";

export interface OpenShellOpenShellRequest {
  sandboxName: string;
  action: OpenShellShellAction;
}

export interface OpenShellOpenShellResult {
  /** The command a user can paste into a terminal: `openshell sandbox connect ...`. */
  command: string;
  /** `true` when Terminal was launched with it. */
  launched: boolean;
}

export interface OpenShellSavedPort {
  port: number;
  /** Optional friendly name, cleaned and capped; `""` when none. */
  name: string;
}

export interface OpenShellGetSavedPortsRequest {
  sandboxName: string;
}

export interface OpenShellSetSavedPortsRequest {
  sandboxName: string;
  /** Replaces the sandbox's whole list. */
  ports: OpenShellSavedPort[];
}

export function isOpenShellForwardPort(value: unknown): value is number {
  return isOpenShellPort(value);
}

const LOOPBACK_BIND_ADDRESSES = new Set(["127.0.0.1", "localhost", "::1", "[::1]", ""]);

/** `true` for a forward that only this machine can reach (or that doesn't report an address). */
export function isOpenShellLoopbackBind(bindAddress: string): boolean {
  return LOOPBACK_BIND_ADDRESSES.has(bindAddress.toLowerCase());
}

/** The only URL "Open in browser" ever opens: loopback, a validated port, plain http. */
export function openShellForwardUrl(port: number): string | null {
  return isOpenShellForwardPort(port) ? `http://localhost:${port}` : null;
}
