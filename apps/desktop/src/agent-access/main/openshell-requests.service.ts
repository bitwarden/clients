import { promises as fs } from "fs";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OPENSHELL_DEFAULT_GATEWAY_NAME, OpenShellDetectionResult } from "../models/openshell";
import {
  isOpenShellResourceName,
  OpenShellManagementError,
  OpenShellManagementResult,
} from "../models/openshell-management";
import {
  cleanOpenShellRequestText,
  isOpenShellChunkId,
  isOpenShellRequestStatus,
  MAX_OPENSHELL_REJECT_REASON_CHARS,
  MAX_OPENSHELL_REQUEST_ENDPOINTS,
  MAX_OPENSHELL_REQUEST_HOST_CHARS,
  MAX_OPENSHELL_REQUEST_NOTE_CHARS,
  MAX_OPENSHELL_REQUEST_PROGRAM_CHARS,
  MAX_OPENSHELL_REQUEST_PROGRAMS,
  MAX_OPENSHELL_REQUEST_RATIONALE_CHARS,
  MAX_OPENSHELL_REQUEST_RULE_CHARS,
  MAX_OPENSHELL_REQUESTS,
  OpenShellRequest,
  OpenShellRequestEndpoint,
  OpenShellRequestStatus,
} from "../models/openshell-requests";

import { OpenShellEnabledState } from "./openshell-enabled-state";
import {
  mapFailure,
  nodeExec,
  OpenShellManagementExec,
  OpenShellManagementExecResult,
  OpenShellManagementFs,
  scrubOpenShellMessage,
} from "./openshell-management.service";

const READ_TIMEOUT_MS = 15_000;
const MUTATION_TIMEOUT_MS = 60_000;
const MAX_ID_CHARS = 64;
const MAX_TIME_CHARS = 64;

const WRITABLE_BINARY_MESSAGE = "The openshell binary location is writable by other users.";

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: OpenShellManagementError; message?: string };

/** A type guard rather than `!result.ok`: the client builds with `strict: false` (see the
 *  management service). */
function isFail<T>(result: Ok<T> | Fail): result is Fail {
  return !result.ok;
}
const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const fail = (error: OpenShellManagementError, message?: string): Fail =>
  message != null && message !== "" ? { ok: false, error, message } : { ok: false, error };
const INVALID = fail("invalidInput");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// ---------------------------------------------------------------------------------------------
// Parsing `openshell rule get`
// ---------------------------------------------------------------------------------------------
//
// VERIFIED (openshell 0.1.2, 2026-10-07, read-only): `rule get` has no `-o json`; it prints text:
//
//   Network Rules:  (version 1, 1 chunk)
//
//     Chunk: <uuid>
//     Status: pending
//     Rule: allow_httpbin_org_443
//     Binary: /usr/bin/curl
//     Confidence: 65%
//     Rationale: Allow curl to connect to httpbin.org:443 (HTTPS).
//     Prover: prover: no new findings
//     Candidate: 0a61b73ed100
//     Endpoints: httpbin.org:443 [L7 rest, access=read-only]
//     Binaries: /usr/bin/curl
//     Hits: 2 (first seen 2026-10-06 21:04:21, last seen 2026-10-06 21:10:29)
//
// and `No network rules for sandbox '<name>'` when there are none.
//
// UNVERIFIED: what a security-flagged chunk prints (no flagged chunk existed). So the reading
// fails closed: a `Prover:` line that is not a plain "no findings", and any line whose key
// mentions security or a flag with a value other than none, marks the chunk flagged.

const FIELD_LINE = /^\s+([A-Za-z][A-Za-z -]{0,30}):\s?(.*)$/;
const CLEAN_PROVER = /^(?:prover:\s*)?(?:no (?:new )?findings|none|clean|ok|passed)\.?$/i;
const NEGATIVE_NOTE = /^(?:none|no|false|n\/a|-|)$/i;
const NO_RULES = /^No network rules for sandbox\b/i;

interface RawChunk {
  fields: Map<string, string[]>;
}

function splitChunks(stdout: string): RawChunk[] | null {
  const lines = stdout.split(/\r?\n/);
  const hasHeader = lines.some((line) => /^Network Rules:/i.test(line));
  if (!hasHeader) {
    return lines.some((line) => NO_RULES.test(line.trim())) || stdout.trim() === "" ? [] : null;
  }
  const chunks: RawChunk[] = [];
  let current: RawChunk | null = null;
  for (const line of lines) {
    const match = FIELD_LINE.exec(line);
    if (match == null) {
      continue;
    }
    const key = match[1].trim().toLowerCase();
    if (key === "chunk") {
      current = { fields: new Map() };
      chunks.push(current);
    }
    if (current == null) {
      continue;
    }
    const values = current.fields.get(key) ?? [];
    values.push(match[2]);
    current.fields.set(key, values);
  }
  return chunks;
}

function first(chunk: RawChunk, key: string): string {
  return chunk.fields.get(key)?.[0] ?? "";
}

/** `host:port [notes]`, comma-separated. A bracketed IPv6 literal is allowed. */
function parseEndpoints(text: string): OpenShellRequestEndpoint[] {
  // Split on commas that are outside square brackets.
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "[") {
      depth++;
    } else if (c === "]") {
      depth = Math.max(0, depth - 1);
    } else if (c === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));

  const endpoints: OpenShellRequestEndpoint[] = [];
  for (const part of parts) {
    const match = /^\s*(\[[0-9A-Fa-f:.]+\]|[^\s:[\]]+):(\d{1,5})(?:\s*\[(.*)\])?\s*$/.exec(part);
    if (match == null) {
      continue;
    }
    const port = Number(match[2]);
    const host = cleanOpenShellRequestText(match[1], MAX_OPENSHELL_REQUEST_HOST_CHARS);
    if (host === "" || port < 1 || port > 65535) {
      continue;
    }
    const access = /(?:^|[\s,])access=([A-Za-z0-9_-]{1,32})/.exec(match[3] ?? "")?.[1] ?? "";
    endpoints.push({ host, port, access });
    if (endpoints.length >= MAX_OPENSHELL_REQUEST_ENDPOINTS) {
      break;
    }
  }
  return endpoints;
}

function parsePrograms(chunk: RawChunk): string[] {
  const listed = first(chunk, "binaries")
    .split(",")
    .map((item) => cleanOpenShellRequestText(item, MAX_OPENSHELL_REQUEST_PROGRAM_CHARS))
    .filter((item) => item !== "");
  const single = cleanOpenShellRequestText(
    first(chunk, "binary"),
    MAX_OPENSHELL_REQUEST_PROGRAM_CHARS,
  );
  const all = [...new Set(single !== "" ? [single, ...listed] : listed)];
  return all.slice(0, MAX_OPENSHELL_REQUEST_PROGRAMS);
}

function parseFlag(chunk: RawChunk): { flagged: boolean; note: string } {
  const notes: string[] = [];
  for (const [key, values] of chunk.fields) {
    const value = cleanOpenShellRequestText(values.join(" "), MAX_OPENSHELL_REQUEST_NOTE_CHARS);
    if (key === "prover") {
      if (!CLEAN_PROVER.test(value)) {
        notes.push(value === "" ? "prover" : value);
      }
    } else if (/security|flag|risk|warning/.test(key) && !NEGATIVE_NOTE.test(value)) {
      notes.push(value);
    }
  }
  return {
    flagged: notes.length > 0,
    note: cleanOpenShellRequestText(notes.join("; "), MAX_OPENSHELL_REQUEST_NOTE_CHARS),
  };
}

function parseHits(text: string): { hits: number | null; firstSeen: string; lastSeen: string } {
  const count = /^\s*(\d{1,9})/.exec(text);
  const firstSeen = /first seen ([^,)]+)/i.exec(text)?.[1] ?? "";
  const lastSeen = /last seen ([^,)]+)/i.exec(text)?.[1] ?? "";
  return {
    hits: count == null ? null : Number(count[1]),
    firstSeen: cleanOpenShellRequestText(firstSeen, MAX_TIME_CHARS),
    lastSeen: cleanOpenShellRequestText(lastSeen, MAX_TIME_CHARS),
  };
}

/** `null` when the output isn't recognisable as a rule listing at all. */
export function parseOpenShellRequests(stdout: string): OpenShellRequest[] | null {
  const chunks = splitChunks(stdout);
  if (chunks == null) {
    return null;
  }
  const requests: OpenShellRequest[] = [];
  for (const chunk of chunks) {
    const id = first(chunk, "chunk").trim();
    const status = first(chunk, "status").trim().toLowerCase();
    // A chunk whose id or status can't be trusted can't be acted on, so it isn't offered.
    if (!isOpenShellChunkId(id) || !isOpenShellRequestStatus(status)) {
      continue;
    }
    const flag = parseFlag(chunk);
    requests.push({
      id: id.slice(0, MAX_ID_CHARS),
      status,
      rule: cleanOpenShellRequestText(first(chunk, "rule"), MAX_OPENSHELL_REQUEST_RULE_CHARS),
      endpoints: parseEndpoints(first(chunk, "endpoints")),
      programs: parsePrograms(chunk),
      rationale: cleanOpenShellRequestText(
        first(chunk, "rationale"),
        MAX_OPENSHELL_REQUEST_RATIONALE_CHARS,
      ),
      flagged: flag.flagged,
      flagNote: flag.note,
      ...parseHits(first(chunk, "hits")),
    });
    if (requests.length >= MAX_OPENSHELL_REQUESTS) {
      break;
    }
  }
  return requests;
}

/**
 * Agent permission requests (agent-access-architecture.md, §M8.20 rule 16): the pending network
 * rules OpenShell records for blocked outbound requests, listed, approved or rejected one at a
 * time. Same contract as the management service: validation before any process, argument arrays
 * only (no shell), the toggle gate, `openshell` by the absolute detected path, the gateway named
 * explicitly, scrubbed messages, and no public method ever throws.
 *
 * `rule approve-all` and `--include-security-flagged` are never built here. A flagged request is
 * approved only when the caller says it was confirmed, and only after main re-reads the request
 * and sees it is still pending.
 */
export class OpenShellRequestsService {
  constructor(
    private logService: LogService,
    private detect: () => Promise<OpenShellDetectionResult>,
    private isAvailable: () => Promise<boolean>,
    private enabledState: OpenShellEnabledState = new OpenShellEnabledState(),
    private exec: OpenShellManagementExec = nodeExec,
    private fsAdapter: Pick<OpenShellManagementFs, "stat"> = {
      stat: (filePath) => fs.stat(filePath),
    },
  ) {}

  async listRequests(request: unknown): Promise<OpenShellManagementResult<OpenShellRequest[]>> {
    return this.guarded(async () => {
      if (
        !isPlainObject(request) ||
        !isOpenShellResourceName(request.sandboxName) ||
        (request.status !== undefined && !isOpenShellRequestStatus(request.status))
      ) {
        return INVALID;
      }
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      return this.read(target.data, request.sandboxName, request.status as OpenShellRequestStatus);
    });
  }

  async approveRequest(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (
        !isPlainObject(request) ||
        !isOpenShellResourceName(request.sandboxName) ||
        !isOpenShellChunkId(request.chunkId) ||
        (request.confirmFlagged !== undefined && typeof request.confirmFlagged !== "boolean")
      ) {
        return INVALID;
      }
      const { sandboxName, chunkId } = request;
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      // Re-read: the id must still be a pending request of this sandbox, and a flagged one needs
      // the explicit confirmation. A stale or forged id never reaches `rule approve`.
      const pending = await this.read(target.data, sandboxName, "pending");
      if (isFail(pending)) {
        return pending;
      }
      const current = pending.data.find((candidate) => candidate.id === chunkId);
      if (current == null) {
        return fail("notFound");
      }
      if (current.flagged && request.confirmFlagged !== true) {
        return INVALID;
      }
      const approved = await this.run(
        target.data,
        ["rule", "approve"],
        [`--chunk-id=${chunkId}`],
        [sandboxName],
        true,
      );
      return isFail(approved) ? approved : ok(undefined);
    });
  }

  async rejectRequest(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (
        !isPlainObject(request) ||
        !isOpenShellResourceName(request.sandboxName) ||
        !isOpenShellChunkId(request.chunkId) ||
        (request.reason !== undefined && typeof request.reason !== "string")
      ) {
        return INVALID;
      }
      const { sandboxName, chunkId } = request;
      // Cleaned, not rejected: a reason with a control character is still a reason.
      const reason = cleanOpenShellRequestText(request.reason, MAX_OPENSHELL_REJECT_REASON_CHARS);
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const rejected = await this.run(
        target.data,
        ["rule", "reject"],
        [`--chunk-id=${chunkId}`, ...(reason !== "" ? [`--reason=${reason}`] : [])],
        [sandboxName],
        true,
      );
      return isFail(rejected) ? rejected : ok(undefined);
    });
  }

  private async read(
    target: { cliPath: string; gateway: string },
    sandboxName: string,
    status: OpenShellRequestStatus | undefined,
  ): Promise<Ok<OpenShellRequest[]> | Fail> {
    const listed = await this.run(
      target,
      ["rule", "get"],
      status != null ? [`--status=${status}`] : [],
      [sandboxName],
      false,
    );
    if (isFail(listed)) {
      return listed;
    }
    const requests = parseOpenShellRequests(listed.data);
    if (requests == null) {
      // Not an empty list: an unreadable listing must not look like "no requests".
      return fail("failed", "Unexpected output from rule get.");
    }
    return ok(status != null ? requests.filter((r) => r.status === status) : requests);
  }

  private async guarded<T>(task: () => Promise<OpenShellManagementResult<T>>) {
    try {
      return await task();
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell requests failed unexpectedly: ${e}`);
      return fail("failed");
    }
  }

  private async target(): Promise<Ok<{ cliPath: string; gateway: string }> | Fail> {
    if (!this.enabledState.isEnabled() || !(await this.isAvailable())) {
      return fail("unsupported");
    }
    const detection = await this.detect();
    if (!detection.present || !detection.platformSupported) {
      return fail("unsupported");
    }
    if (detection.cliPath == null || detection.cliPath === "") {
      return fail("cliMissing");
    }
    const gateway =
      detection.gateways.find((candidate) => candidate.active)?.name ??
      detection.gateways[0]?.name ??
      OPENSHELL_DEFAULT_GATEWAY_NAME;
    if (!isOpenShellResourceName(gateway)) {
      return fail("failed", "The active gateway name is not usable.");
    }
    if (!(await this.isBinaryLocationSafe(detection.cliPath))) {
      return fail("failed", WRITABLE_BINARY_MESSAGE);
    }
    return ok({ cliPath: detection.cliPath, gateway });
  }

  /** Same rule as the management service: the binary must not be group- or world-writable and its
   *  directory must not be world-writable. A binary that can't be inspected is reported as missing
   *  by the run itself. */
  private async isBinaryLocationSafe(cliPath: string): Promise<boolean> {
    const checks: Array<[string, number]> = [
      [cliPath, 0o022],
      [path.dirname(cliPath), 0o002],
    ];
    for (const [candidate, unsafeBits] of checks) {
      try {
        if (((await this.fsAdapter.stat(candidate)).mode & unsafeBits) !== 0) {
          return false;
        }
      } catch {
        // Missing: the exec reports it as `cliMissing`.
      }
    }
    return true;
  }

  /** Runs `openshell <command...> --gateway=<name> <flags...> <positionals...>`; resolves to stdout. */
  private async run(
    target: { cliPath: string; gateway: string },
    command: string[],
    flags: string[],
    positionals: string[],
    mutation: boolean,
  ): Promise<Ok<string> | Fail> {
    const args = [...command, `--gateway=${target.gateway}`, ...flags, ...positionals];
    let result: OpenShellManagementExecResult;
    try {
      result = await this.exec.run(
        target.cliPath,
        args,
        mutation ? MUTATION_TIMEOUT_MS : READ_TIMEOUT_MS,
      );
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell command could not be run: ${e}`);
      return fail("failed");
    }
    if (result.code !== 0 || result.spawnFailed === true) {
      const failure = mapFailure(result, mutation);
      this.logService.warning(
        `[Agent Access] OpenShell ${command.join(" ")} failed (${failure.error}): ${scrubOpenShellMessage(failure.message ?? "")}`,
      );
      return failure;
    }
    return ok(result.stdout);
  }
}
