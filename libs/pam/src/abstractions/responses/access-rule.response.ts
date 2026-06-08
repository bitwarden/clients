import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { Condition, parseConditions, parseRule, ruleToConditions } from "../access-rule";

export class AccessRuleResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  conditions: Condition[];
  collections: string[];
  defaultLeaseDurationSeconds: number | null;
  /** Hard ceiling on any single lease's duration, in seconds. Null = no cap. */
  maxLeaseDurationSeconds: number | null;
  singleActiveLease: boolean;
  enabled: boolean;
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
    // Prefer an explicit `Conditions` list when present; otherwise reconstruct
    // it from the server's canonical `Rule` tree (the GET response carries the
    // tree, not a flat conditions list).
    const rawConditions = this.getResponseProperty("Conditions");
    if (rawConditions != null) {
      this.conditions = parseConditions(rawConditions);
    } else {
      const rule = parseRule(this.getResponseProperty("Rule"));
      this.conditions = rule ? ruleToConditions(rule) : [];
    }
    const collections = this.getResponseProperty("Collections");
    this.collections = Array.isArray(collections) ? collections.map(String) : [];
    const duration = this.getResponseProperty("DefaultLeaseDurationSeconds");
    this.defaultLeaseDurationSeconds = typeof duration === "number" ? duration : null;
    const maxDuration = this.getResponseProperty("MaxLeaseDurationSeconds");
    this.maxLeaseDurationSeconds = typeof maxDuration === "number" ? maxDuration : null;
    this.singleActiveLease = Boolean(this.getResponseProperty("SingleActiveLease"));
    const enabled = this.getResponseProperty("Enabled");
    this.enabled = enabled == null ? true : Boolean(enabled);
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.lastEditedByUserId = this.getResponseProperty("LastEditedByUserId") ?? null;
    this.lastEditedByName = this.getResponseProperty("LastEditedByName") ?? null;
  }
}
