import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import {
  AccessCondition,
  parseAccessConditions,
  parseConditionTree,
  treeToConditions,
} from "../access-rule";

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
  /** Maximum number of times a single lease may be extended. Null when extensions are not allowed. */
  maxExtensions: number | null;
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
    // The server's `conditions` carries the canonical AccessCondition tree;
    // the mock may serve a flat list. Reconstruct the UI's flat list either way.
    const rawConditions = this.getResponseProperty("Conditions");
    if (Array.isArray(rawConditions)) {
      this.conditions = parseAccessConditions(rawConditions);
    } else {
      const tree = parseConditionTree(rawConditions);
      this.conditions = tree ? treeToConditions(tree) : [];
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
    this.allowsExtensions = Boolean(this.getResponseProperty("AllowsExtensions"));
    const maxExtensions = this.getResponseProperty("MaxExtensions");
    this.maxExtensions = typeof maxExtensions === "number" ? maxExtensions : null;
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.lastEditedByUserId = this.getResponseProperty("LastEditedByUserId") ?? null;
    this.lastEditedByName = this.getResponseProperty("LastEditedByName") ?? null;
  }
}
