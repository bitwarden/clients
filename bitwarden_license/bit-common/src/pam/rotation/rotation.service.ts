import { UserId } from "@bitwarden/common/types/guid";
import type {
  OrganizationId,
  RotationConfigActions,
  RotationConfigId,
  RotationConfigView,
  RotationJob,
  RotationScheduleClient,
} from "@bitwarden/sdk-internal";

import { describePamError } from "../shared/pam-error-message";
import { toSdkId } from "../shared/pam-ids";
import { PamInputError } from "../shared/pam-input-error";
import { PamSdkService } from "../shared/pam-sdk.service";

import { parseRotationRequest } from "./rotation-request";
import { resolveRotationSchedule, ResolvedRotationSchedule } from "./rotation-schedule";

/** A config with the actions it offers right now. */
export interface RotationConfigWithActions {
  readonly config: RotationConfigView;
  readonly actions: RotationConfigActions;
}

export interface RotationConfigDetail extends RotationConfigWithActions {
  /** Newest first, cut to the requested count. */
  readonly jobs: RotationJob[];
}

export type RotationGuardedAction = "rotate" | "pause" | "resume" | "record-manual";

/**
 * The PAM rotation operations the CLI offers, over the SDK's `rotation()` client. It checks
 * `actions()` before the verbs that depend on it and turns a refusal into a reason, so the
 * operator learns why before the server is asked. The server stays the authority.
 *
 * Nothing here logs or returns the account identity: it is read only to resend it on `update`.
 */
export class RotationService {
  constructor(private pamSdk: PamSdkService) {}

  async list(userId: UserId, organizationId: string): Promise<RotationConfigWithActions[]> {
    return await this.pamSdk.run(userId, async (pam) => {
      const configs = pam.rotation().configs();
      const views = await configs.list(toSdkId<OrganizationId>(organizationId, "organization id"));
      return views.map((config) => ({ config, actions: configs.actions(config, undefined) }));
    });
  }

  async get(
    userId: UserId,
    organizationId: string,
    configId: string,
    jobLimit: number,
  ): Promise<RotationConfigDetail> {
    return await this.pamSdk.run(userId, async (pam) => {
      const configs = pam.rotation().configs();
      const detail = await configs.get(
        toSdkId<OrganizationId>(organizationId, "organization id"),
        toSdkId<RotationConfigId>(configId, "config id"),
      );
      return {
        config: detail.config,
        actions: configs.actions(detail.config, undefined),
        jobs: detail.jobs.slice(0, jobLimit),
      };
    });
  }

  async create(
    userId: UserId,
    organizationId: string,
    json: string,
    scheduleInput?: string,
  ): Promise<{ result: RotationConfigWithActions; schedule?: ResolvedRotationSchedule }> {
    return await this.pamSdk.run(userId, async (pam) => {
      const request = parseRotationRequest(json);
      const schedule = this.applySchedule(pam.rotation().schedule(), scheduleInput);
      if (schedule != null) {
        request.scheduleCron = schedule.cron;
      }
      const configs = pam.rotation().configs();
      const detail = await configs.create(
        toSdkId<OrganizationId>(organizationId, "organization id"),
        request,
      );
      return {
        result: { config: detail.config, actions: configs.actions(detail.config, undefined) },
        schedule,
      };
    });
  }

  /**
   * Re-seals the whole blob. Fields the JSON omits keep their current value. Refuses a change of
   * cipher or target system, and a change to the account fields while a job is active; the
   * schedule may always change.
   */
  async update(
    userId: UserId,
    organizationId: string,
    configId: string,
    json: string,
    scheduleInput?: string,
  ): Promise<{ result: RotationConfigWithActions; schedule?: ResolvedRotationSchedule }> {
    return await this.pamSdk.run(userId, async (pam) => {
      const orgId = toSdkId<OrganizationId>(organizationId, "organization id");
      const id = toSdkId<RotationConfigId>(configId, "config id");
      const configs = pam.rotation().configs();
      const existing = (await configs.get(orgId, id)).config;
      const request = parseRotationRequest(json, existing);

      if (
        request.cipherId !== existing.cipherId ||
        request.targetSystemId !== existing.targetSystemId
      ) {
        throw new PamInputError("The cipher and the target system of a config cannot be changed.");
      }
      const schedule = this.applySchedule(pam.rotation().schedule(), scheduleInput);
      if (schedule != null) {
        request.scheduleCron = schedule.cron;
      }

      const actions = configs.actions(existing, undefined);
      const accountChanged =
        existing.sealed == null ||
        request.accountIdentity !== existing.sealed.accountIdentity ||
        request.terminateSessions !== existing.sealed.terminateSessions;
      if (actions.mutationsLocked && accountChanged) {
        throw new PamInputError(
          "A rotation is active, so the account identity and session settings cannot change now. The schedule can.",
        );
      }

      const detail = await configs.update(orgId, id, request);
      return {
        result: { config: detail.config, actions: configs.actions(detail.config, undefined) },
        schedule,
      };
    });
  }

  async delete(userId: UserId, organizationId: string, configId: string): Promise<void> {
    await this.pamSdk.run(userId, async (pam) => {
      const orgId = toSdkId<OrganizationId>(organizationId, "organization id");
      const id = toSdkId<RotationConfigId>(configId, "config id");
      const configs = pam.rotation().configs();
      const { config } = await configs.get(orgId, id);
      if (configs.actions(config, undefined).mutationsLocked) {
        throw new PamInputError("A rotation is active, so this config cannot be deleted now.");
      }
      await configs.delete(orgId, id);
    });
  }

  /** The verbs guarded by `actions()`. Refuses with the reason when the config does not offer it. */
  async perform(
    userId: UserId,
    organizationId: string,
    configId: string,
    action: RotationGuardedAction,
  ): Promise<void> {
    await this.pamSdk.run(userId, async (pam) => {
      const orgId = toSdkId<OrganizationId>(organizationId, "organization id");
      const id = toSdkId<RotationConfigId>(configId, "config id");
      const configs = pam.rotation().configs();
      const { config } = await configs.get(orgId, id);
      const refusal = refusalReason(action, config, configs.actions(config, undefined));
      if (refusal != null) {
        throw new PamInputError(refusal);
      }
      try {
        switch (action) {
          case "rotate":
            await configs.rotate_now(orgId, id);
            break;
          case "pause":
            await configs.pause(orgId, id);
            break;
          case "resume":
            await configs.resume(orgId, id);
            break;
          case "record-manual":
            await configs.record_manual_rotation(orgId, id);
            break;
        }
      } catch (e) {
        throw action === "rotate" ? mapRotateError(e) : e;
      }
    });
  }

  /** Resolves a schedule offline. Still needs a signed-in user for the SDK client. */
  async resolveSchedule(userId: UserId, value: string): Promise<ResolvedRotationSchedule> {
    return await this.pamSdk.run(userId, async (pam) =>
      resolveRotationSchedule(pam.rotation().schedule(), value),
    );
  }

  private applySchedule(
    client: RotationScheduleClient,
    value: string | undefined,
  ): ResolvedRotationSchedule | undefined {
    return value == null ? undefined : resolveRotationSchedule(client, value);
  }
}

/** Why `action` is refused for this config, or `undefined` when it is offered. */
export function refusalReason(
  action: RotationGuardedAction,
  config: RotationConfigView,
  actions: RotationConfigActions,
): string | undefined {
  switch (action) {
    case "rotate":
      if (actions.canRotateNow) {
        return undefined;
      }
      if (config.targetSystemMethod === "manual") {
        return "This target is rotated by hand. Rotate it yourself, then run `record-manual`.";
      }
      if (!config.enabled) {
        return "This config is paused. Resume it before rotating.";
      }
      return config.hasActiveJob
        ? "A rotation is already active for this config."
        : "This config cannot be rotated now.";
    case "pause":
      if (actions.canPause) {
        return undefined;
      }
      return config.enabled
        ? "This config cannot be paused now."
        : "This config is already paused.";
    case "resume":
      if (actions.canResume) {
        return undefined;
      }
      return config.enabled ? "This config is not paused." : "This config cannot be resumed now.";
    case "record-manual":
      if (actions.canRecordManual) {
        return undefined;
      }
      if (config.targetSystemMethod !== "manual") {
        return "Recording a manual rotation applies to manual-method targets only.";
      }
      return config.awaitingManualRotation
        ? "A manual rotation cannot be recorded now."
        : "This config is not waiting for a manual rotation.";
  }
}

/** Names the cooldown for a rate-limit or conflict refusal of `rotate_now`. */
function mapRotateError(e: unknown): unknown {
  const info = describePamError(e);
  if (info.status === 429) {
    return new PamInputError(
      "This config was rotated too recently. Wait for the server cooldown to pass, then try again.",
    );
  }
  if (info.kind === "conflict" && info.code == null) {
    return new PamInputError(
      "The server refused a new rotation. The per-config cooldown may not have passed, or a rotation is already active.",
    );
  }
  return e;
}
