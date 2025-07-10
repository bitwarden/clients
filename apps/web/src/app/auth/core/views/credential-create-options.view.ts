import { ChallengeResponse } from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";

export class CredentialCreateOptionsView {
  constructor(
    readonly options: ChallengeResponse,
    readonly token: string,
  ) {}
}
