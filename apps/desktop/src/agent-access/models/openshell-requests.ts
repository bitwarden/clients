import { OpenShellManagementResult } from "./openshell-management";

// Agent permission requests (agent-access-architecture.md, §M8.20 rule 16): the pending network
// rules ("chunks") OpenShell records when a sandbox is blocked from reaching something. Contract
// only: types, validators and the one text sanitizer both processes use. Every string on an
// `OpenShellRequest` came from the gateway, i.e. from whatever the sandboxed agent made it write,
// so it is untrusted: cleaned and capped here, rendered as text only, never used to build a
// command without being validated again.

export type OpenShellRequestStatus = "pending" | "approved" | "rejected";

export const OPENSHELL_REQUEST_STATUSES: readonly OpenShellRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
];

export const MAX_OPENSHELL_REQUESTS = 100;
export const MAX_OPENSHELL_REQUEST_ENDPOINTS = 10;
export const MAX_OPENSHELL_REQUEST_PROGRAMS = 10;
export const MAX_OPENSHELL_REQUEST_HOST_CHARS = 255;
export const MAX_OPENSHELL_REQUEST_PROGRAM_CHARS = 255;
export const MAX_OPENSHELL_REQUEST_RATIONALE_CHARS = 500;
export const MAX_OPENSHELL_REQUEST_RULE_CHARS = 128;
export const MAX_OPENSHELL_REQUEST_NOTE_CHARS = 300;
export const MAX_OPENSHELL_REJECT_REASON_CHARS = 200;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const INVISIBLE_CHARS = /[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const CHUNK_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Text from the gateway made safe to show or log: control characters, bidi controls and
 * zero-width/invisible formatting characters removed, whitespace runs collapsed, trimmed, capped.
 * It stays plain text; callers must never put it in markup.
 */
export function cleanOpenShellRequestText(text: unknown, maxChars: number): string {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

/** A chunk id as the gateway issues it (a UUID). Never a flag, a path or free text. */
export function isOpenShellChunkId(value: unknown): value is string {
  return typeof value === "string" && CHUNK_ID.test(value);
}

export function isOpenShellRequestStatus(value: unknown): value is OpenShellRequestStatus {
  return (
    typeof value === "string" && (OPENSHELL_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

/** One place a request wants to reach. */
export interface OpenShellRequestEndpoint {
  host: string;
  port: number;
  /** The gateway's access note (for example `read-only`), cleaned; empty when none. */
  access: string;
}

export interface OpenShellRequest {
  /** The chunk id: the only thing sent back to approve or reject. */
  id: string;
  status: OpenShellRequestStatus;
  /** The gateway's rule name. */
  rule: string;
  endpoints: OpenShellRequestEndpoint[];
  /** Programs that tried to connect (absolute paths as reported). */
  programs: string[];
  /** Why the agent says it needs it. Untrusted text. */
  rationale: string;
  /** `true` when the gateway's prover reported anything other than "no findings", or any
   *  security note was present. Treated as flagged when the report can't be read. */
  flagged: boolean;
  /** The gateway's own words about the flag, cleaned. Empty when not flagged. */
  flagNote: string;
  /** How many times it was blocked; `null` when not reported. */
  hits: number | null;
  firstSeen: string;
  lastSeen: string;
}

export interface OpenShellListRequestsRequest {
  sandboxName: string;
  /** Omitted for everything the gateway has for the sandbox. */
  status?: OpenShellRequestStatus;
}

export interface OpenShellApproveRequestRequest {
  sandboxName: string;
  chunkId: string;
  /** Must be `true` to approve a flagged request. Main re-reads the request and checks. */
  confirmFlagged?: boolean;
}

export interface OpenShellRejectRequestRequest {
  sandboxName: string;
  chunkId: string;
  reason?: string;
}

export type OpenShellRequestsResult = OpenShellManagementResult<OpenShellRequest[]>;
