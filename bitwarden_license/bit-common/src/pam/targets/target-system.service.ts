import { UserId } from "@bitwarden/common/types/guid";
import type {
  OrganizationId,
  TargetSystemCreateRequest,
  TargetSystemId,
  TargetSystemView,
} from "@bitwarden/sdk-internal";

import { targetSystemCreatePendingId } from "../shared/pam-error-message";
import { parseGuid, sdkIdToString, toSdkId } from "../shared/pam-ids";
import { PamInputError } from "../shared/pam-input-error";
import { PamSdkService } from "../shared/pam-sdk.service";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

import {
  TARGET_SYSTEM_METHODS,
  TargetSystemMethodInput,
  validateTargetSystemRequest,
} from "./target-system-request";
import { TargetSystemSummary } from "./target-system.models";

/** The longest target system name printed. */
const MAX_NAME_LENGTH = 200;

/**
 * A create whose second phase (sealing) failed. The row exists as `pending_seal`; `id` is its id
 * and `cause` is the SDK's own error, which never holds sealed values.
 */
export class TargetSystemPendingSealError extends Error {
  constructor(
    readonly id: string,
    readonly cause: unknown,
  ) {
    super("The target system was created but could not be sealed.");
    this.name = "TargetSystemPendingSealError";
  }
}

/**
 * Target system operations over `rotation().target_systems()`. Ids are validated as GUIDs before
 * any call. This class takes no logger and never copies sealed fields into a result: the SDK
 * service logs only an error's name and message when a call fails.
 */
export class TargetSystemService {
  constructor(private pamSdk: PamSdkService) {}

  async list(userId: string, organizationId: string): Promise<TargetSystemSummary[]> {
    const org = toOrg(organizationId);
    const views = await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().target_systems().list(org),
    );
    return views.map(toSummary);
  }

  /**
   * Registers a target system from a request already shaped by `validateTargetSystemRequest`.
   * @throws TargetSystemPendingSealError when the seal step failed after the row was created.
   */
  async create(
    userId: string,
    organizationId: string,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystemSummary> {
    const org = toOrg(organizationId);
    try {
      const view = await this.pamSdk.run(
        toUser(userId),
        async (pam) => await pam.rotation().target_systems().create(org, request),
      );
      return toSummary(view);
    } catch (e) {
      const pendingId = targetSystemCreatePendingId(e);
      if (pendingId != null) {
        throw new TargetSystemPendingSealError(parseGuid(pendingId, "target system id"), e);
      }
      throw e;
    }
  }

  /**
   * Re-seals the whole blob. `input` may omit `name` and `method`, which are read from the
   * existing row (the only non-sealed values), but every sealed field must be in it.
   * @throws PamInputError when the target system is not in the organization's list.
   */
  async update(
    userId: string,
    organizationId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<void> {
    const org = toOrg(organizationId);
    const targetId = toTarget(id);
    const user = toUser(userId);

    let fallback: { name?: string; method?: TargetSystemMethodInput } = {};
    if (input.name == null || input.method == null) {
      const views = await this.pamSdk.run(
        user,
        async (pam) => await pam.rotation().target_systems().list(org),
      );
      const existing = views.find((v) => sdkIdToString(v.id) === parseGuid(id, "target system id"));
      if (existing == null) {
        throw new PamInputError("Target system not found in this organization.");
      }
      const method = (TARGET_SYSTEM_METHODS as readonly string[]).includes(existing.method)
        ? (existing.method as TargetSystemMethodInput)
        : undefined;
      fallback = { name: existing.name, method };
    }
    const request = validateTargetSystemRequest(input, fallback);
    await this.pamSdk.run(
      user,
      async (pam) => await pam.rotation().target_systems().update(org, targetId, request),
    );
  }

  async enable(userId: string, organizationId: string, id: string): Promise<void> {
    const org = toOrg(organizationId);
    const targetId = toTarget(id);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().target_systems().enable(org, targetId),
    );
  }

  /** New rotation jobs stop being dispatched. Jobs already in flight run to completion. */
  async disable(userId: string, organizationId: string, id: string): Promise<void> {
    const org = toOrg(organizationId);
    const targetId = toTarget(id);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().target_systems().disable(org, targetId),
    );
  }

  async delete(userId: string, organizationId: string, id: string): Promise<void> {
    const org = toOrg(organizationId);
    const targetId = toTarget(id);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().target_systems().delete(org, targetId),
    );
  }
}

function toSummary(view: TargetSystemView): TargetSystemSummary {
  return {
    id: sdkIdToString(view.id),
    organizationId: sdkIdToString(view.organizationId),
    name: sanitizeUntrusted(view.name, MAX_NAME_LENGTH),
    method: view.method,
    status: view.status,
    sealed: view.sealed != null,
    creationDate: view.creationDate,
    revisionDate: view.revisionDate,
  };
}

function toUser(userId: string): UserId {
  return parseGuid(userId, "user id") as UserId;
}

function toOrg(organizationId: string): OrganizationId {
  return toSdkId<OrganizationId>(organizationId, "organization id");
}

function toTarget(id: string): TargetSystemId {
  return toSdkId<TargetSystemId>(id, "target system id");
}
