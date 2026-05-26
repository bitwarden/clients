import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessRule, parseAccessRule } from "../access-rule";

export class AccessRuleResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  rule: AccessRule;
  collections: string[];
  creationDate: string;
  revisionDate: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.description = this.getResponseProperty("Description") ?? null;
    this.rule = parseAccessRule(this.getResponseProperty("Rule"));
    const collections = this.getResponseProperty("Collections");
    this.collections = Array.isArray(collections) ? collections.map(String) : [];
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}
