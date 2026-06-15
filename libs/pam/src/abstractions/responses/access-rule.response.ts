import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessCondition, parseAccessConditions } from "../access-rule";

export class AccessRuleResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  conditions: AccessCondition[];
  collections: string[];
  defaultLeaseDurationSeconds: number | null;
  /** Hard ceiling on any single lease's duration, in seconds. Null = no cap. */
  maxLeaseDurationSeconds: number | null;
  singleActiveLease: boolean;
  enabled: boolean;
  allowsExtensions: boolean;
  /** Longest a single extension may run, in seconds. Null when extensions are not allowed. */
  maxExtensionDurationSeconds: number | null;
  creationDate: string;
  revisionDate: string;
  lastEditedByUserId: string | null;
  lastEditedByName: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.description = this.getResponseProperty("Description") ?? null;
    // The server's `Conditions` is a flat array of conditions.
    this.conditions = parseAccessConditions(this.getResponseProperty("Conditions"));
    const collections = this.getResponseProperty("Collections");
    this.collections = Array.isArray(collections) ? collections.map(String) : [];
    const duration = this.getResponseProperty("DefaultLeaseDurationSeconds");
    this.defaultLeaseDurationSeconds = typeof duration === "number" ? duration : null;
    const maxDuration = this.getResponseProperty("MaxLeaseDurationSeconds");
    this.maxLeaseDurationSeconds = typeof maxDuration === "number" ? maxDuration : null;
    this.singleActiveLease = Boolean(this.getResponseProperty("SingleActiveLease"));
    const enabled = this.getResponseProperty("Enabled");
    this.enabled = enabled == null ? true : Boolean(enabled);
    this.allowsExtensions = Boolean(this.getResponseProperty("AllowsExtensions"));
    const maxExtensionDurationSeconds = this.getResponseProperty("MaxExtensionDurationSeconds");
    this.maxExtensionDurationSeconds =
      typeof maxExtensionDurationSeconds === "number" ? maxExtensionDurationSeconds : null;
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.lastEditedByUserId = this.getResponseProperty("LastEditedByUserId") ?? null;
    this.lastEditedByName = this.getResponseProperty("LastEditedByName") ?? null;
  }
}
