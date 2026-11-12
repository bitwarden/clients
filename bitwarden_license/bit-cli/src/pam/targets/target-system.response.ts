import { PamErrorInfo } from "@bitwarden/bit-common/pam/shared";
import type { TargetSystemSummary } from "@bitwarden/bit-common/pam/targets";
import type { TargetSystemCreateRequest } from "@bitwarden/sdk-internal";

import { isoDate, PamErrorResponse, PamObject, PamResponse } from "../shared";

/**
 * A target system as `bw privileged-controls target` prints it. Flat, with ids, states and timestamps and the
 * name. The sealed fields (kind, password policy, session termination) are never printed:
 * `sealed` says only whether the server's blob unsealed.
 */
export class TargetSystemResponse extends PamResponse {
  id: string;
  organizationId: string;
  name: string;
  method: string;
  status: string;
  sealed: boolean;
  creationDate?: string;
  revisionDate?: string;

  constructor(target: TargetSystemSummary) {
    super(PamObject.TargetSystem);
    this.id = target.id;
    this.organizationId = target.organizationId;
    this.name = target.name;
    this.method = target.method;
    this.status = target.status;
    this.sealed = target.sealed;
    this.creationDate = isoDate(target.creationDate);
    this.revisionDate = isoDate(target.revisionDate);
  }
}

/** The failed response of a `create` whose seal step failed, so a script can read the id. */
export class TargetSystemPendingSealResponse extends PamErrorResponse {
  /** The id of the row left as `pending_seal`. */
  pendingId: string;

  constructor(info: PamErrorInfo, pendingId: string) {
    super(info);
    this.pendingId = pendingId;
  }
}

/**
 * A request template. It carries the usual `object` field, which `create` and `update` ignore, so
 * a saved template can be sent back as it is.
 */
export class TargetSystemTemplateResponse extends PamResponse {
  constructor(template: TargetSystemCreateRequest) {
    super("pam-target-system-template");
    Object.assign(this, template);
  }
}
