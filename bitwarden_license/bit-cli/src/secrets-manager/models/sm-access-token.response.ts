import { AccessTokenView } from "@bitwarden/bit-common/secrets-manager/service-accounts/models/view/access-token.view";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmAccessTokenResponse implements BaseResponse {
  object = "sm-access-token";

  id: string;
  machineAccountId: string;
  name: string;
  scopes: string[];
  expireAt: Date | null;
  creationDate: Date;
  revisionDate: Date;

  constructor(machineAccountId: string, accessToken: AccessTokenView) {
    this.id = accessToken.id;
    this.machineAccountId = machineAccountId;
    this.name = accessToken.name;
    this.scopes = accessToken.scopes;
    this.expireAt = accessToken.expireAt ?? null;
    this.creationDate = accessToken.creationDate;
    this.revisionDate = accessToken.revisionDate;
  }
}

/**
 * The result of creating an access token. `accessToken` is the only copy of the token's secret.
 */
export class SmAccessTokenCreatedResponse implements BaseResponse {
  object = "sm-access-token";

  id: string;
  machineAccountId: string;
  name: string;
  expireAt: Date | null;
  accessToken: string;

  constructor(
    id: string,
    machineAccountId: string,
    name: string,
    expireAt: Date | null,
    accessToken: string,
  ) {
    this.id = id;
    this.machineAccountId = machineAccountId;
    this.name = name;
    this.expireAt = expireAt;
    this.accessToken = accessToken;
  }
}
