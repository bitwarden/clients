import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export type SmCountsScope = "organization" | "project" | "machine-account";

export class SmCountsResponse implements BaseResponse {
  object = "sm-counts";

  scope: SmCountsScope;
  id: string;
  projects?: number;
  secrets?: number;
  machineAccounts?: number;
  people?: number;
  accessTokens?: number;

  constructor(
    scope: SmCountsScope,
    id: string,
    counts: Omit<Partial<SmCountsResponse>, "object" | "scope" | "id">,
  ) {
    this.scope = scope;
    this.id = id;
    Object.assign(this, counts);
  }
}
