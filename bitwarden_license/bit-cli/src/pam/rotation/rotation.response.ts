import {
  RotationConfigDetail,
  RotationConfigWithActions,
  ResolvedRotationSchedule,
  scheduleWarning,
} from "@bitwarden/bit-common/pam/rotation";
import { PamNames, sanitizeUntrusted } from "@bitwarden/bit-common/pam/shared";
import type { RotationAttempt, RotationJob } from "@bitwarden/sdk-internal";

import { isoDate, PamObject, PamResponse } from "../shared";

/** The longest `failureReason` printed. The text is untrusted, so it is cut short. */
const FAILURE_REASON_LENGTH = 120;

/**
 * A rotation config. `accountIdentity` and the other sealed fields are never written: only
 * whether the account identity is set. `targetSystemName` comes from the server, so it is
 * sanitized.
 */
export class RotationConfigResponse extends PamResponse {
  id: string;
  organizationId: string;
  cipherId: string;
  /** Present with `--names`, and only when the cipher is in the synced vault. */
  cipherName?: string;
  targetSystemId: string;
  targetSystemName: string;
  targetSystemMethod: string;
  accountIdentitySet: boolean;
  scheduleCron: string | null;
  rotateOnAccessEnd: boolean;
  enabled: boolean;
  lastRotationAt: string | null;
  nextRotationAt: string | null;
  hasActiveJob: boolean;
  awaitingManualRotation: boolean;
  canRotateNow: boolean;
  canRecordManual: boolean;
  mutationsLocked: boolean;
  canPause: boolean;
  canResume: boolean;
  creationDate: string | null;
  revisionDate: string | null;
  /** Only on `get`: the newest jobs first. */
  jobs?: RotationJobResponse[];

  constructor(item: RotationConfigWithActions, names?: PamNames) {
    super(PamObject.RotationConfig);
    const { config, actions } = item;
    this.id = String(config.id);
    this.organizationId = String(config.organizationId);
    this.cipherId = String(config.cipherId);
    if (names != null) {
      const name = names.cipher(this.cipherId);
      if (name !== this.cipherId) {
        this.cipherName = name;
      }
    }
    this.targetSystemId = String(config.targetSystemId);
    this.targetSystemName = sanitizeUntrusted(config.targetSystemName);
    this.targetSystemMethod = config.targetSystemMethod;
    this.accountIdentitySet = (config.sealed?.accountIdentity?.length ?? 0) > 0;
    this.scheduleCron = config.scheduleCron ?? null;
    this.rotateOnAccessEnd = config.rotateOnAccessEnd;
    this.enabled = config.enabled;
    this.lastRotationAt = isoDate(config.lastRotationAt) ?? null;
    this.nextRotationAt = isoDate(config.nextRotationAt) ?? null;
    this.hasActiveJob = config.hasActiveJob;
    this.awaitingManualRotation = config.awaitingManualRotation;
    this.canRotateNow = actions.canRotateNow;
    this.canRecordManual = actions.canRecordManual;
    this.mutationsLocked = actions.mutationsLocked;
    this.canPause = actions.canPause;
    this.canResume = actions.canResume;
    this.creationDate = isoDate(config.creationDate) ?? null;
    this.revisionDate = isoDate(config.revisionDate) ?? null;
  }

  static detail(detail: RotationConfigDetail, names?: PamNames): RotationConfigResponse {
    const response = new RotationConfigResponse(detail, names);
    response.jobs = detail.jobs.map((job) => new RotationJobResponse(job));
    return response;
  }
}

/**
 * One rotation job and its latest attempt. The failure code is the stable field; the reason is
 * untrusted connector text, shown only when there is no usable code, sanitized and truncated.
 */
export class RotationJobResponse extends PamResponse {
  id: string;
  source: string;
  status: string;
  createdAt: string | null;
  claimedAt: string | null;
  attempts: number;
  lastAttemptStatus: string | null;
  failureCode: string | null;
  failureReason: string | null;
  cipherUpdated: boolean | null;

  constructor(job: RotationJob) {
    super("pam-rotation-job");
    const last: RotationAttempt | undefined = job.attempts[job.attempts.length - 1];
    this.id = String(job.id);
    this.source = job.source;
    this.status = job.status;
    this.createdAt = isoDate(job.createdAt) ?? null;
    this.claimedAt = isoDate(job.claimedAt) ?? null;
    this.attempts = job.attempts.length;
    this.lastAttemptStatus = last == null ? null : String(last.status);
    this.failureCode = last?.failureCode == null ? null : String(last.failureCode);
    const useReason =
      last?.failureReason != null && (this.failureCode == null || this.failureCode === "unknown");
    this.failureReason = useReason
      ? sanitizeUntrusted(last.failureReason, FAILURE_REASON_LENGTH)
      : null;
    this.cipherUpdated = last == null ? null : last.cipherUpdated;
  }
}

/** The result of resolving a schedule. */
export class RotationScheduleResponse extends PamResponse {
  preset: string;
  scheduleCron: string | null;
  likelyQuartz: boolean;
  warning: string | null;

  constructor(resolved: ResolvedRotationSchedule) {
    super("pam-rotation-schedule");
    this.preset = resolved.preset;
    this.scheduleCron = resolved.cron ?? null;
    this.likelyQuartz = resolved.likelyQuartz;
    this.warning = scheduleWarning(resolved) ?? null;
  }
}

/** The result of a rotation verb that changes state. */
export class RotationActionResponse extends PamResponse {
  action: string;
  configId: string;
  done = true;

  constructor(action: string, configId: string) {
    super("pam-rotation-action");
    this.action = action;
    this.configId = configId;
  }
}
