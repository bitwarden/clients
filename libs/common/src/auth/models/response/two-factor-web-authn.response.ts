import { BaseResponse } from "../../../models/response/base.response";
import { Utils } from "../../../platform/misc/utils";

export class TwoFactorWebAuthnResponse extends BaseResponse {
  enabled: boolean;
  keys: KeyResponse[];

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    const keys = this.getResponseProperty("Keys");
    this.keys = keys == null ? null : keys.map((k: any) => new KeyResponse(k));
  }
}

export class KeyResponse extends BaseResponse {
  name: string;
  id: number;
  migrated: boolean;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.id = this.getResponseProperty("Id");
    this.migrated = this.getResponseProperty("Migrated");
  }
}

export class ChallengeResponse extends BaseResponse implements PublicKeyCredentialCreationOptions {
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  challenge: BufferSource;
  excludeCredentials?: PublicKeyCredentialDescriptor[];
  extensions?: AuthenticationExtensionsClientInputs;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  rp: PublicKeyCredentialRpEntity;
  timeout?: number;
  user: PublicKeyCredentialUserEntity;

  constructor(response: any) {
    super(response);
    this.attestation = this.getResponseProperty("attestation");
    this.authenticatorSelection = this.getResponseProperty("authenticatorSelection");
    this.challenge = Utils.fromUrlB64ToArray(this.getResponseProperty("challenge"));
    this.excludeCredentials = this.getResponseProperty("excludeCredentials").map((c: any) => {
      c.id = Utils.fromUrlB64ToArray(c.id).buffer;
      return c;
    });
    this.extensions = this.getResponseProperty("extensions");
    this.pubKeyCredParams = this.getResponseProperty("pubKeyCredParams");
    this.rp = this.getResponseProperty("rp");
    this.timeout = this.getResponseProperty("timeout");

    const user = this.getResponseProperty("user");
    user.id = Utils.fromUrlB64ToArray(user.id);

    this.user = user;
  }
}
