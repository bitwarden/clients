import { randomUUID } from "crypto";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OPENSHELL_DEFAULT_GATEWAY_NAME, OpenShellDetectionResult } from "../models/openshell";
import {
  cleanOpenShellDisplayText,
  cleanOpenShellPurpose,
  isOpenShellMetaColor,
  OPENSHELL_MAX_ENVIRONMENTS,
  OPENSHELL_MAX_NAME_CHARS,
  OPENSHELL_MAX_SANDBOX_META,
  OPENSHELL_MAX_SECRET_SETS,
  OpenShellEnvironment,
  OpenShellSandboxMeta,
  OpenShellSecretSet,
  parseOpenShellEnvironmentBody,
  parseOpenShellSecretRefs,
} from "../models/openshell-environments";
import {
  isOpenShellResourceName,
  isOpenShellVaultId,
  OpenShellManagementError,
  OpenShellManagementResult,
} from "../models/openshell-management";

import { OpenShellEnabledState } from "./openshell-enabled-state";
import { OpenShellEnvironmentsStore } from "./openshell-environments-store";

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: OpenShellManagementError; message?: string };

/** A type guard rather than `!result.ok`: this client builds with `strict: false`. */
function isFail<T>(result: Ok<T> | Fail): result is Fail {
  return result.ok === false;
}

const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const fail = (error: OpenShellManagementError, message?: string): Fail => ({
  ok: false,
  error,
  ...(message != null ? { message } : {}),
});
const INVALID = fail("invalidInput");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Environments, secret sets and sandbox metadata (agent-access-architecture.md, §M8.20 rule 17).
 * App-side only: nothing here runs `openshell`, reads the vault or touches a gateway, so no process
 * is ever started. Every request is validated before the store is read or written; ids are
 * assigned here (never taken from a new-item request); every public method resolves to a result
 * and none throws.
 *
 * The data is keyed by the active gateway's name and is only reachable behind the same gate as the
 * rest of management (toggle on, OpenShell present on a supported platform, driver set up), so a
 * disabled integration answers `unsupported` here too.
 */
export class OpenShellEnvironmentsService {
  constructor(
    private logService: LogService,
    private store: OpenShellEnvironmentsStore,
    private detect: () => Promise<OpenShellDetectionResult>,
    private isAvailable: () => Promise<boolean>,
    private enabledState: OpenShellEnabledState,
  ) {}

  // -------------------------------------------------------------------------------------------
  // Environments
  // -------------------------------------------------------------------------------------------

  async listEnvironments(): Promise<OpenShellManagementResult<OpenShellEnvironment[]>> {
    return this.guarded(async (gateway) => ok((await this.store.read(gateway)).environments));
  }

  async saveEnvironment(
    request: unknown,
  ): Promise<OpenShellManagementResult<OpenShellEnvironment>> {
    return this.guarded(async (gateway) => {
      if (!isPlainObject(request)) {
        return INVALID;
      }
      const id = request.id as string | null | undefined;
      if (id != null && !isOpenShellVaultId(id)) {
        return INVALID;
      }
      const body = parseOpenShellEnvironmentBody(request);
      if (body == null) {
        return INVALID;
      }
      const environment: OpenShellEnvironment = { id: id ?? randomUUID(), ...body };
      let failure: Fail | null = null;
      const outcome = await this.store.update(gateway, (data) => {
        const index = data.environments.findIndex((e) => e.id === environment.id);
        if (id != null && index < 0) {
          failure = fail("notFound");
          return false;
        }
        if (data.environments.some((e) => e.id !== environment.id && sameName(e.name, body.name))) {
          failure = fail("alreadyExists");
          return false;
        }
        if (index < 0 && data.environments.length >= OPENSHELL_MAX_ENVIRONMENTS) {
          failure = fail("failed", "There are too many environments; delete one first.");
          return false;
        }
        if (body.secretSetId != null && !data.secretSets.some((s) => s.id === body.secretSetId)) {
          failure = fail("notFound");
          return false;
        }
        if (index < 0) {
          data.environments.push(environment);
        } else {
          data.environments[index] = environment;
        }
        return true;
      });
      return this.finish(outcome, failure, environment);
    });
  }

  async deleteEnvironment(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async (gateway) => {
      if (!isPlainObject(request) || !isOpenShellVaultId(request.id)) {
        return INVALID;
      }
      const id = request.id as string | null | undefined;
      let failure: Fail | null = null;
      const outcome = await this.store.update(gateway, (data) => {
        if (!data.environments.some((e) => e.id === id)) {
          failure = fail("notFound");
          return false;
        }
        data.environments = data.environments.filter((e) => e.id !== id);
        return true;
      });
      return this.finish(outcome, failure, undefined);
    });
  }

  // -------------------------------------------------------------------------------------------
  // Secret sets
  // -------------------------------------------------------------------------------------------

  async listSecretSets(): Promise<OpenShellManagementResult<OpenShellSecretSet[]>> {
    return this.guarded(async (gateway) => ok((await this.store.read(gateway)).secretSets));
  }

  async saveSecretSet(request: unknown): Promise<OpenShellManagementResult<OpenShellSecretSet>> {
    return this.guarded(async (gateway) => {
      if (!isPlainObject(request) || typeof request.name !== "string") {
        return INVALID;
      }
      const id = request.id as string | null | undefined;
      if (id != null && !isOpenShellVaultId(id)) {
        return INVALID;
      }
      const name = cleanOpenShellDisplayText(request.name, OPENSHELL_MAX_NAME_CHARS);
      const secrets = parseOpenShellSecretRefs(request.secrets);
      if (name === "" || secrets == null || secrets.length === 0) {
        return INVALID;
      }
      const set: OpenShellSecretSet = { id: id ?? randomUUID(), name, secrets };
      let failure: Fail | null = null;
      const outcome = await this.store.update(gateway, (data) => {
        const index = data.secretSets.findIndex((s) => s.id === set.id);
        if (id != null && index < 0) {
          failure = fail("notFound");
          return false;
        }
        if (data.secretSets.some((s) => s.id !== set.id && sameName(s.name, name))) {
          failure = fail("alreadyExists");
          return false;
        }
        if (index < 0 && data.secretSets.length >= OPENSHELL_MAX_SECRET_SETS) {
          failure = fail("failed", "There are too many secret sets; delete one first.");
          return false;
        }
        if (index < 0) {
          data.secretSets.push(set);
        } else {
          data.secretSets[index] = set;
        }
        return true;
      });
      return this.finish(outcome, failure, set);
    });
  }

  /** A set an environment still points at is not deleted: its environments would lose secrets. */
  async deleteSecretSet(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async (gateway) => {
      if (!isPlainObject(request) || !isOpenShellVaultId(request.id)) {
        return INVALID;
      }
      const id = request.id as string | null | undefined;
      let failure: Fail | null = null;
      const outcome = await this.store.update(gateway, (data) => {
        if (!data.secretSets.some((s) => s.id === id)) {
          failure = fail("notFound");
          return false;
        }
        const using = data.environments.filter((e) => e.secretSetId === id);
        if (using.length > 0) {
          failure = fail(
            "failed",
            `This set is used by ${using.length} environment${using.length === 1 ? "" : "s"}.`,
          );
          return false;
        }
        data.secretSets = data.secretSets.filter((s) => s.id !== id);
        return true;
      });
      return this.finish(outcome, failure, undefined);
    });
  }

  // -------------------------------------------------------------------------------------------
  // Sandbox metadata
  // -------------------------------------------------------------------------------------------

  /** Every sandbox's metadata on the gateway; sandboxes with none are not listed. */
  async getSandboxMeta(): Promise<OpenShellManagementResult<OpenShellSandboxMeta[]>> {
    return this.guarded(async (gateway) =>
      ok(Object.values((await this.store.read(gateway)).sandboxMeta)),
    );
  }

  /** An empty purpose and no color removes the entry (also how it is cleaned up on delete). */
  async setSandboxMeta(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async (gateway) => {
      if (
        !isPlainObject(request) ||
        !isOpenShellResourceName(request.name) ||
        typeof request.purpose !== "string" ||
        (request.color != null && !isOpenShellMetaColor(request.color))
      ) {
        return INVALID;
      }
      const name = request.name;
      const purpose = cleanOpenShellPurpose(request.purpose);
      const color = request.color == null ? null : (request.color as OpenShellSandboxMeta["color"]);
      let failure: Fail | null = null;
      const outcome = await this.store.update(gateway, (data) => {
        const existing = data.sandboxMeta[name];
        if (purpose === "" && color == null) {
          if (existing == null) {
            return false;
          }
          delete data.sandboxMeta[name];
          return true;
        }
        if (
          existing == null &&
          Object.keys(data.sandboxMeta).length >= OPENSHELL_MAX_SANDBOX_META
        ) {
          failure = fail("failed", "There are too many sandboxes with details.");
          return false;
        }
        if (existing?.purpose === purpose && existing.color === color) {
          return false;
        }
        data.sandboxMeta[name] = { name, purpose, color };
        return true;
      });
      return this.finish(outcome, failure, undefined);
    });
  }

  // -------------------------------------------------------------------------------------------

  private finish<T>(
    outcome: "written" | "unchanged" | "failed",
    failure: Fail | null,
    data: T,
  ): Ok<T> | Fail {
    if (failure != null) {
      return failure;
    }
    return outcome === "failed" ? fail("failed", "The change could not be saved.") : ok(data);
  }

  /** Never lets an unexpected exception cross the IPC boundary. */
  private async guarded<T>(
    task: (gateway: string) => Promise<Ok<T> | Fail>,
  ): Promise<OpenShellManagementResult<T>> {
    try {
      const gateway = await this.gateway();
      if (isFail(gateway)) {
        return gateway;
      }
      return await task(gateway.data);
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell environments failed unexpectedly: ${e}`);
      return fail("failed");
    }
  }

  /** The active gateway's name, or `unsupported` behind the same gate as management (rule 6). */
  private async gateway(): Promise<Ok<string> | Fail> {
    if (!this.enabledState.isEnabled() || !(await this.isAvailable())) {
      return fail("unsupported");
    }
    const detection = await this.detect();
    if (!detection.present || !detection.platformSupported) {
      return fail("unsupported");
    }
    const gateway =
      detection.gateways.find((candidate) => candidate.active)?.name ??
      detection.gateways[0]?.name ??
      OPENSHELL_DEFAULT_GATEWAY_NAME;
    if (!isOpenShellResourceName(gateway)) {
      return fail("failed", "The active gateway name is not usable.");
    }
    return ok(gateway);
  }
}
