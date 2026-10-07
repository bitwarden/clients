import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  AgentAccessActivityEntry,
  AgentAccessActivityOrigin,
  AgentAccessActivityType,
  AgentAccessRequestStatus,
} from "../models/agent-access-activity";
import {
  isOpenShellSandboxId,
  OpenShellActivityEvent,
  OpenShellActivityOutcome,
} from "../models/openshell-activity";
import { OpenShellManagementResult } from "../models/openshell-management";

const MAX_EVENTS = 200;
const MAX_AGENT_NAME_CHARS = 64;
// Control, bidi-control and zero-width characters, as for every other gateway-derived label.
const UNSAFE_LABEL_CODES = new Set<number>([
  ...Array.from({ length: 0x20 }, (_, i) => i),
  ...Array.from({ length: 0x21 }, (_, i) => 0x7f + i),
  ...Array.from({ length: 0x10 }, (_, i) => 0x200b + i),
  ...Array.from({ length: 5 }, (_, i) => 0x202a + i),
  ...Array.from({ length: 4 }, (_, i) => 0x2066 + i),
  0xfeff,
]);

function cleanLabel(text: string): string {
  return Array.from(text)
    .filter((char) => !UNSAFE_LABEL_CODES.has(char.codePointAt(0)))
    .join("")
    .trim();
}

function outcomeOf(status: AgentAccessRequestStatus): OpenShellActivityOutcome {
  switch (status) {
    case AgentAccessRequestStatus.Shared:
      return "allowed";
    case AgentAccessRequestStatus.NotFound:
      return "notFound";
    case AgentAccessRequestStatus.Pending:
      return "pending";
    default:
      return "denied";
  }
}

/**
 * Answers "what has the agent done in this sandbox?" from the credential-resolve rows main already
 * records (§M8.8). Read-only and in-memory: no process is run, no file is read, and the answer is
 * a reduced copy: ids, digests and target ids in the buffer never leave this class.
 *
 * Attribution is by the gateway-reported sandbox id the attested gateway sent with the request;
 * a row without an id, or with another sandbox's, is never included.
 */
export class OpenShellActivityService {
  constructor(
    private readonly logService: LogService,
    private readonly isAvailable: () => Promise<boolean>,
    private readonly getEntries: () => readonly AgentAccessActivityEntry[],
  ) {}

  async listActivity(
    request: unknown,
  ): Promise<OpenShellManagementResult<OpenShellActivityEvent[]>> {
    try {
      const sandboxId = (request as { sandboxId?: unknown } | null)?.sandboxId;
      if (!isOpenShellSandboxId(sandboxId)) {
        return { ok: false, error: "invalidInput" };
      }
      if (!(await this.isAvailable())) {
        return { ok: false, error: "unsupported" };
      }
      const events: OpenShellActivityEvent[] = [];
      for (const entry of this.getEntries()) {
        if (
          entry.type !== AgentAccessActivityType.CredentialRequest ||
          entry.origin !== AgentAccessActivityOrigin.OpenShell ||
          entry.sandboxId !== sandboxId
        ) {
          continue;
        }
        const atMs = Number(entry.timestampMs);
        if (!Number.isFinite(atMs)) {
          continue;
        }
        const agentName =
          typeof entry.agentName === "string"
            ? cleanLabel(entry.agentName).slice(0, MAX_AGENT_NAME_CHARS)
            : "";
        events.push({
          id: entry.id,
          atMs,
          agentName: agentName.length > 0 ? agentName : null,
          outcome: outcomeOf(entry.status),
          secretCount: entry.targetIds?.length ?? 0,
        });
      }
      events.sort((a, b) => b.atMs - a.atMs);
      return { ok: true, data: events.slice(0, MAX_EVENTS) };
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell activity read failed: ${e}`);
      return { ok: false, error: "failed" };
    }
  }
}
