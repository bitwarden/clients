import { VerifyingKey, WrappedSigningKey } from "../../types";

export class SignatureKeyPairResponse {
  readonly wrappedSigningKey: WrappedSigningKey;
  readonly verifyingKey: VerifyingKey;

  constructor(response: unknown) {
    if (typeof response !== "object" || response == null) {
      throw new TypeError("Response must be an object");
    }

    if (!("wrappedSigningKey" in response) || typeof response.wrappedSigningKey !== "string") {
      throw new TypeError("Response must contain a valid wrappedSigningKey");
    }
    this.wrappedSigningKey = response.wrappedSigningKey as WrappedSigningKey;

    if (!("verifyingKey" in response) || typeof response.verifyingKey !== "string") {
      throw new TypeError("Response must contain a valid verifyingKey");
    }
    this.verifyingKey = response.verifyingKey as VerifyingKey;
  }
}
