import { describePamError, PamErrorKind } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

/**
 * The response conventions every `bw privileged-controls` group follows:
 *
 * - `object` is a `pam-` discriminator such as `pam-request`, `pam-lease` or `pam-rule`.
 * - Dates are ISO 8601 UTC strings; see {@link isoDate}.
 * - Fields are flat: no nested objects beyond arrays of ids.
 * - Only ids, states and timestamps are written. Never reasons, comments, tokens, sealed fields,
 *   `accountIdentity` or `failureReason`, and never a vault secret. Names are written only for
 *   `--names`, and only to stdout.
 * - `canceled` is spelled with one L, as in the SDK.
 */
export type PamObjectName = `pam-${string}`;

/** The discriminators the groups use, kept together so the names do not drift. */
export const PamObject = Object.freeze({
  Request: "pam-request",
  RequestPreCheck: "pam-request-precheck",
  AccessState: "pam-access-state",
  Lease: "pam-lease",
  Approval: "pam-approval",
  Rule: "pam-rule",
  Connector: "pam-connector",
  TargetSystem: "pam-target-system",
  RotationConfig: "pam-rotation-config",
  Status: "pam-status",
  Error: "pam-error",
} as const satisfies Record<string, PamObjectName>);

/** Base class for a `bw privileged-controls` response object. */
export abstract class PamResponse implements BaseResponse {
  protected constructor(readonly object: PamObjectName) {}
}

/** The ISO 8601 UTC string for a date or date string, or `undefined` when absent or unparseable. */
export function isoDate(value: string | Date | null | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/** Attached to a failed response, so `--response` consumers can branch without parsing text. */
export class PamErrorResponse extends PamResponse {
  kind: PamErrorKind;
  code?: string;
  variant?: string;
  status?: number;

  constructor(info: ReturnType<typeof describePamError>) {
    super(PamObject.Error);
    this.kind = info.kind;
    this.code = info.code;
    this.variant = info.variant;
    this.status = info.status;
  }
}

/** A failed {@link Response} for any error a PAM operation throws. Prints text and variant only. */
export function pamErrorResponse(e: unknown): Response {
  const info = describePamError(e);
  return Response.error(info.message, new PamErrorResponse(info));
}
